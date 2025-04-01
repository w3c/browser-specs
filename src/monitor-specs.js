'use strict';

/**
 * The monitor-specs script loops through the list of open issues in the
 * browser-specs repository that have a "new spec" label, checks those that
 * have not been reviewed for a while, and adds a comment and "review" label to
 * those that seems worth reviewing again because an update was detected since
 * last review.
 *
 * The last time that an issue was reviewed is the last time that the "review"
 * label was removed, which the script retrieves thanks through the GraphQL
 * endpoint.
 *
 * To report the list of issues that need a review (without updating the
 * issues), run:
 * node src/monitor-specs.js
 *
 * To report the list of issues that need a review **and** also update the
 * issues to add a comment/label, run:
 * node src/monitor-specs.js --update
 */

import sendGraphQLQuery from "./graphql.js";
import splitIssueBodyIntoSections from "./split-issue-body.js";
import loadJSON from "./load-json.js";

const config = await loadJSON("config.json");
const githubToken = config?.GITHUB_TOKEN ?? process.env.GITHUB_TOKEN;


/**
 * The list of specs that are already known is derived from open and closed
 * issues in the browser-specs repository.
 */
const BROWSER_SPECS_REPO = {
  owner: "w3c",
  name: "browser-specs"
};


/**
 * Script does not update GitHub issues by default
 */
const updateGitHubIssues =
  (process.argv[2] === "--update") ||
  (process.argv[2] === "-u");


/**
 * Retrieve the list of specs and repositories that should not be reported
 * because we're already aware of them and their treatment is still pending or
 * we explicitly don't want to add them to browser-specs.
 */
async function fetchIssuesToReview() {
  let list = [];

  // Retrieve the list of open issues that have a "new spec" label and,
  // for each of them, the last "unlabeled" events.
  // Notes:
  // - Issues that have a "review" label get skipped for now. By definition,
  // a review is already pending for them. If this script is run every couple
  // of months, there should not be any issue in that category though...
  // - The code assumes that we won't ever set more than 10 different labels on
  // a single issue and that we'll find a "review" label removal within the
  // last 5 "unlabeled" events. That seems more than enough for now.
  let hasNextPage = true;
  let endCursor = "";
  while (hasNextPage) {
    const response = await sendGraphQLQuery(`query {
      organization(login: "${BROWSER_SPECS_REPO.owner}") {
        repository(name: "${BROWSER_SPECS_REPO.name}") {
          issues(
            states: OPEN,
            labels: "new spec",
            first: 100
            ${endCursor ? ', after: "' + endCursor + '"' : ''}
          ) {
            pageInfo {
              endCursor
              hasNextPage
            }
            nodes {
              id
              number
              title
              body
              createdAt
              labels(first: 10) {
                nodes {
                  name
                }
              }
              timelineItems(last: 5, itemTypes: UNLABELED_EVENT) {
                nodes {
                  ... on UnlabeledEvent {
                    label {
                      name
                    }
                    createdAt
                  }
                }
              }
            }
          }
        }
      }
    }`, githubToken);
    if (!response?.data?.organization?.repository?.issues) {
      console.log(JSON.stringify(response, null, 2));
      throw new Error(`GraphQL error, could not retrieve the list of issues`);
    }
    const issues = response.data.organization.repository.issues;
    list.push(...issues.nodes
      .filter(issue => !issue.labels.nodes.find(label => label.name === "review"))
    );
    hasNextPage = issues.pageInfo.hasNextPage;
    endCursor = issues.pageInfo.endCursor;
  }

  return list;
}


/**
 * Set a label on a GitHub issue
 */
const labelIds = {};
async function setIssueLabel(issue, label) {
  if (!labelIds[label]) {
    // Retrieve the label ID from GitHub if we don't know anything about it yet
    const labelResponse = await sendGraphQLQuery(`query {
      organization(login: "${BROWSER_SPECS_REPO.owner}") {
        repository(name: "${BROWSER_SPECS_REPO.name}") {
          label(name: "${label}") {
            id
          }
        }
      }
    }`, githubToken);
    if (!labelResponse?.data?.organization?.repository?.label?.id) {
      console.log(JSON.stringify(labelResponse, null, 2));
      throw new Error(`GraphQL error, could not retrieve the "${label}" label`);
    }
    labelIds[label] = labelResponse.data.organization.repository.label.id;
  }

  // Set the label on the issue
  const response = await sendGraphQLQuery(`mutation {
    addLabelsToLabelable(input: {
      labelableId: "${issue.id}"
      labelIds: ["${labelIds[label]}"]
      clientMutationId: "mutatis mutandis"
    }) {
      labelable {
        ... on Issue {
          id
        }
      }
    }
  }`, githubToken);
  if (!response?.data?.addLabelsToLabelable?.labelable?.id) {
    console.log(JSON.stringify(response, null, 2));
    throw new Error(`GraphQL error, could not add "${label}" label to issue #${session.number}`);
  }
}


/**
 * Add the "review" label to the given issue, along with a comment
 */
let reviewLabelId = null;
async function flagIssueForReview(issue, comment) {
  if (comment) {
    // Using a variable to avoid having to deal with comment escaping issues
    const commentResponse = await sendGraphQLQuery(`
      mutation($comment: AddCommentInput!) {
        addComment(input: $comment) {
          subject {
            id
          }
        }
      }`, {
        comment: {
          subjectId: issue.id,
          body: comment,
          clientMutationId: "mutatis mutandis"
        }
      },
      githubToken);
    if (!commentResponse?.data?.addComment?.subject?.id) {
      console.log(JSON.stringify(commentResponse, null, 2));
      throw new Error(`GraphQL error, could not add comment to issue #${issue.number}`);
    }
  }

  await setIssueLabel(issue, "review");
}


fetchIssuesToReview().then(async issues => {
  const issuesToReview = [];
  for (const issue of issues) {
    const lastReviewedEvent = issue.timelineItems.nodes.find(event =>
      event.label.name === "review");
    issue.lastReviewed = (new Date(lastReviewedEvent ?
        lastReviewedEvent.createdAt :
        issue.createdAt))
      .toJSON()
      .slice(0, 10);

    const sections = splitIssueBodyIntoSections(issue.body);
    const urlSection = sections.find(section => section.title === 'URL');
    if (!urlSection) {
      console.warn(`- ${issue.title} (#${issue.number}) does not follow the expected issue format`);
      if (updateGitHubIssues) {
        await setIssueLabel(issue, "invalid");
      }
      continue;
    }

    // Retrieve the spec and check the last-modified HTTP header
    const response = await fetch(urlSection.value);
    const { headers } = response;

    // The CSS drafts use a proprietary header to expose the real last
    // modification date
    issue.lastRevised = (new Date(headers.get('Last-Revised') ?
        headers.get('Last-Revised') :
        headers.get('Last-Modified')))
      .toJSON()
      .slice(0, 10);
    if (issue.lastRevised > issue.lastReviewed) {
      issuesToReview.push(issue);
    }
    // We don't need the response's body, but not reading it means Node will keep
    // the network request in memory, which prevents the CLI from returning until
    // a timeout occurs.
    await response.arrayBuffer();
  }

  if (issuesToReview.length === 0) {
    console.log('No candidate spec to review');
    return;
  }

  console.log('Candidate specs to review:');
  console.log(issuesToReview
    .map(issue => `- ${issue.title} (#${issue.number}) updated on ${issue.lastRevised} (last reviewed on ${issue.lastReviewed})`)
    .join('\n')
  );

  if (!updateGitHubIssues) {
    return;
  }

  console.log('Mark GitHub issues as needing a review...');
  for (const issue of issues) {
    const comment = `The specification was updated on **${issue.lastRevised}** (last reviewed on ${issue.lastReviewed}).`;
    await flagIssueForReview(issue, comment);
  }
  console.log('Mark GitHub issues as needing a review... done');
});
