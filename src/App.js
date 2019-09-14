// @flow

import React from 'react';
import './App.css';
import graphql from 'babel-plugin-relay/macro';
import {QueryRenderer, fetchQuery} from 'react-relay';
import Posts from './Posts';
import Post from './Post';
import Header from './Header';
import Comments from './Comments';
import {onegraphAuth} from './Environment';
import {Route, Switch} from 'react-router-dom';
import Link from './PreloadLink';
import idx from 'idx';
import {NotificationContainer} from './Notifications';
import OneGraphLogo from './oneGraphLogo';
import {Grommet, Grid, Box, Heading, Text, Anchor} from 'grommet';
import {StatusCritical} from 'grommet-icons';
import ScrollMemory from 'react-router-scroll-memory';
import {matchPath} from 'react-router-dom';
import UserContext from './UserContext';
import Home from './Home';

import type {App_ViewerQueryResponse} from './__generated__/App_Query.graphql';
import type {Environment} from 'relay-runtime';
import type {RelayNetworkError} from 'react-relay';

const theme = {
  name: 'onegraph',
  rounding: 4,
  spacing: 24,
  global: {
    font: {
      family: 'Helvetica Neue,Helvetica,Arial,sans-serif',
      size: '14px',
      height: '20px',
    },
  },
};

const postsRootQuery = graphql`
  query App_Query($owner: String!, $repo: String!)
    @persistedQueryConfiguration(
      accessToken: {environmentVariable: "OG_GITHUB_TOKEN"}
      #fixedVariables: {environmentVariable: ""}
    ) {
    gitHub {
      repository(name: $repo, owner: $owner) {
        ...Header_repository
        ...Posts_repository
      }
    }
  }
`;

const ErrorBox = ({error}: {error: Error}) => {
  // $FlowFixMe
  const relayError = idx(error, _ => _.source.errors[0].message);
  return (
    <Box
      margin="medium"
      gap="xsmall"
      justify="center"
      align="center"
      direction="row">
      <StatusCritical color="status-error" />{' '}
      <Text size="medium">{relayError || error.message}</Text>
    </Box>
  );
};

const PostsRoot = ({
  error,
  props,
}: {
  error: ?Error,
  props: ?App_ViewerQueryResponse,
}) => {
  if (error) {
    return <ErrorBox error={error} />;
  }
  if (!props) {
    return null;
  }
  const respository = props.gitHub ? props.gitHub.repository : null;
  if (!respository) {
    return <ErrorBox error={new Error('Repository not found.')} />;
  } else {
    return (
      <>
        <Header repository={respository} />
        <Posts repository={respository} />
      </>
    );
  }
};

export const postRootQuery = graphql`
  query App_Post_Query($issueNumber: Int!, $owner: String!, $repo: String!)
    @persistedQueryConfiguration(
      accessToken: {environmentVariable: "OG_GITHUB_TOKEN"}
    ) {
    gitHub {
      repository(name: $repo, owner: $owner) {
        ...Header_repository
        issue(number: $issueNumber) {
          labels(first: 100) {
            nodes {
              name
            }
          }
          id
          ...Post_post
          ...Comments_post
        }
      }
    }
  }
`;

const PostRoot = ({
  error,
  props,
}: {
  error: ?Error,
  props: ?App_ViewerQueryResponse,
}) => {
  if (error) {
    return <ErrorBox error={error} />;
  }
  if (!props) {
    return null;
  }
  const repository = idx(props, _ => _.gitHub.repository);
  const post = idx(props, _ => _.gitHub.repository.issue);
  const labels = idx(post, _ => _.labels.nodes) || [];
  if (!post || !labels.map(l => l.name.toLowerCase()).includes('publish')) {
    return <ErrorBox error={new Error('Missing post.')} />;
  } else {
    return (
      <>
        <Header repository={repository} />
        <Box>
          <Post post={post} />
          <Comments post={post} postId={post.id} />
        </Box>
      </>
    );
  }
};

const RenderRoute = ({routeConfig, environment, match}) => (
  <QueryRenderer
    dataFrom="STORE_THEN_NETWORK"
    fetchPolicy="store-and-network"
    environment={environment}
    query={routeConfig.query}
    variables={routeConfig.getVariables(match)}
    render={routeConfig.component}
  />
);

export const routes = [
  {
    path: '/:owner/:repo',
    exact: true,
    strict: false,
    query: postsRootQuery,
    getVariables: (match: any) => ({
      owner: match.params.owner,
      repo: match.params.repo,
    }),
    component: PostsRoot,
  },
  {
    path: '/:owner/:repo/post/:issueNumber',
    exact: true,
    strict: false,
    query: postRootQuery,
    getVariables: (match: any) => ({
      owner: match.params.owner,
      repo: match.params.repo,
      issueNumber: parseInt(match.params.issueNumber, 10),
    }),
    component: PostRoot,
  },
];

export default class App extends React.Component<
  {environment: Environment},
  {isLoggedIn: boolean},
> {
  state = {
    isLoggedIn: false,
  };
  componentDidMount() {
    onegraphAuth
      .isLoggedIn('github')
      .then(isLoggedIn => this.setState({isLoggedIn}));
  }
  _login = () => {
    onegraphAuth
      .login('github')
      .then(() =>
        onegraphAuth
          .isLoggedIn('github')
          .then(isLoggedIn => this.setState({isLoggedIn})),
      );
  };
  _logout = () => {
    onegraphAuth
      .logout('github')
      .then(() =>
        onegraphAuth
          .isLoggedIn('github')
          .then(isLoggedIn => this.setState({isLoggedIn})),
      );
  };
  render() {
    return (
      <UserContext.Provider
        value={{
          isLoggedIn: this.state.isLoggedIn,
          login: this._login,
          logout: this._logout,
        }}>
        <NotificationContainer>
          <Grommet theme={theme}>
            <Grid
              fill
              rows={['auto', 'flex']}
              columns={['flex']}
              areas={[
                {name: 'header', start: [0, 0], end: [1, 0]},
                {name: 'main', start: [0, 1], end: [1, 1]},
              ]}>
              <Box gridArea="main">
                <ScrollMemory />
                <Switch>
                  <Route path="/" exact strict component={Home} />
                  {routes.map((routeConfig, i) => (
                    <Route
                      key={i}
                      path={routeConfig.path}
                      exact={routeConfig.exact}
                      strict={routeConfig.strict}
                      render={props => (
                        <RenderRoute
                          environment={this.props.environment}
                          match={props.match}
                          routeConfig={routeConfig}
                        />
                      )}
                    />
                  ))}
                </Switch>
              </Box>
            </Grid>
          </Grommet>
        </NotificationContainer>
      </UserContext.Provider>
    );
  }
}
