import './polyfills';
import { AppBase } from '@votingworks/ui';
import { BrowserRouter, Redirect, Route, Switch } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import styled from 'styled-components';
import { ApiClientContext, createApiClient, createQueryClient } from './api';
import { ElectionsScreen } from './elections_screen';
import { electionParamRoutes, routes } from './routes';
import { ElectionInfoScreen } from './election_info_screen';
import { GeographyScreen } from './geography_screen';
import { ContestsScreen } from './contests_screen';
import { BallotsScreen } from './ballots_screen';
import { TabulationScreen } from './tabulation_screen';
import { ExportScreen } from './export_screen';

function ElectionScreens(): JSX.Element {
  return (
    <Switch>
      <Route
        path={electionParamRoutes.electionInfo.path}
        component={ElectionInfoScreen}
      />
      <Route
        path={electionParamRoutes.geography.root.path}
        component={GeographyScreen}
      />
      <Route
        path={electionParamRoutes.contests.root.path}
        component={ContestsScreen}
      />
      <Route
        path={electionParamRoutes.ballots.root.path}
        component={BallotsScreen}
      />
      <Route
        path={electionParamRoutes.tabulation.path}
        component={TabulationScreen}
      />
      <Route path={electionParamRoutes.export.path} component={ExportScreen} />
      <Redirect
        from={electionParamRoutes.root.path}
        to={electionParamRoutes.electionInfo.path}
      />
    </Switch>
  );
}

const StyleOverrides = styled.div`
  width: 100%;
  height: 100%;

  button,
  input[type='checkbox'],
  input[type='radio'] {
    cursor: pointer;
  }

  h1 {
    margin-bottom: 1.2rem;

    &:not(:first-child) {
      margin-top: 1rem;
    }
  }

  h2 {
    margin-bottom: 0.8rem;
  }

  a {
    color: ${({ theme }) => theme.colors.foreground};
  }
`;

export function App(): JSX.Element {
  return (
    <AppBase>
      <StyleOverrides>
        <ApiClientContext.Provider value={createApiClient()}>
          <QueryClientProvider client={createQueryClient()}>
            <BrowserRouter>
              <Switch>
                <Route
                  path={routes.root.path}
                  exact
                  component={ElectionsScreen}
                />
                <Route
                  path={electionParamRoutes.root.path}
                  component={ElectionScreens}
                />
              </Switch>
            </BrowserRouter>
          </QueryClientProvider>
        </ApiClientContext.Provider>
      </StyleOverrides>
    </AppBase>
  );
}
