/**
 * Send a GraphQL request to the GitHub GraphQL endpoint, authenticating using
 * the provided token.
 */
export default async function (query, variables, graphqlToken) {
  if (typeof variables === 'string') {
    graphqlToken = variables;
    variables = null;
  }
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `bearer ${graphqlToken}`
    },
    body: JSON.stringify({ query, variables }, null, 2)
  });
  if (res.status !== 200) {
    if (res.status >= 500) {
      throw new Error(`GraphQL server error, ${res.status} status received`);
    }
    if (res.status === 403) {
      throw new Error(`GraphQL server reports that the API key is invalid, ${res.status} status received`);
    }
    throw new Error(`GraphQL server returned an unexpected HTTP status ${res.status}`);
  }
  return res.json();
}
