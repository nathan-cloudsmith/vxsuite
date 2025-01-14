//
// The durable datastore for configuration info.
//

import { Client as DbClient } from '@votingworks/db';
import {
  ElectionDefinition,
  safeParseElectionDefinition,
  SystemSettings,
  SystemSettingsDbRow,
} from '@votingworks/types';
import { join } from 'path';

const SchemaPath = join(__dirname, '../schema.sql');

/**
 * Manages a data store for imported election definition and system settings
 */
export class Store {
  private constructor(private readonly client: DbClient) {}

  getDbPath(): string {
    return this.client.getDatabasePath();
  }

  /**
   * Builds and returns a new store whose data is kept in memory.
   */
  static memoryStore(): Store {
    return new Store(DbClient.memoryClient(SchemaPath));
  }

  /**
   * Builds and returns a new store at `dbPath`.
   */
  static fileStore(dbPath: string): Store {
    return new Store(DbClient.fileClient(dbPath, SchemaPath));
  }

  /**
   * Resets the database and any cached data in the store.
   */
  reset(): void {
    this.client.reset();
  }

  /**
   * Gets whether an election is currently configured.
   */
  hasElection(): boolean {
    return Boolean(this.client.one('select id from election'));
  }

  /**
   * Gets the current election definition.
   */
  getElectionDefinition(): ElectionDefinition | undefined {
    const electionRow = this.client.one(
      'select election_data as electionData from election'
    ) as { electionData: string } | undefined;

    if (!electionRow?.electionData) {
      return undefined;
    }

    const electionDefinitionParseResult = safeParseElectionDefinition(
      electionRow.electionData
    );

    if (electionDefinitionParseResult.isErr()) {
      throw new Error('Unable to parse stored election data.');
    }

    const electionDefinition = electionDefinitionParseResult.ok();

    return {
      ...electionDefinition,
      election: {
        ...electionDefinition.election,
      },
    };
  }

  /**
   * Gets the current jurisdiction.
   */
  getJurisdiction(): string | undefined {
    const electionRow = this.client.one('select jurisdiction from election') as
      | { jurisdiction: string }
      | undefined;
    return electionRow?.jurisdiction;
  }

  /**
   * Sets the current election definition and jurisdiction.
   */
  setElectionAndJurisdiction(input?: {
    electionData: string;
    jurisdiction: string;
  }): void {
    this.client.run('delete from election');
    if (input) {
      this.client.run(
        'insert into election (election_data, jurisdiction) values (?, ?)',
        input.electionData,
        input.jurisdiction
      );
    }
  }

  /**
   * Deletes system settings
   */
  deleteSystemSettings(): void {
    this.client.run('delete from system_settings');
  }

  /**
   * Creates a system settings record
   */
  setSystemSettings(systemSettings: SystemSettings): void {
    this.client.run('delete from system_settings');
    this.client.run(
      `
      insert into system_settings (
        are_poll_worker_card_pins_enabled,
        inactive_session_time_limit_minutes,
        num_incorrect_pin_attempts_allowed_before_card_lockout,
        overall_session_time_limit_hours,
        starting_card_lockout_duration_seconds
      ) values (
        ?, ?, ?, ?, ?
      )
      `,
      systemSettings.arePollWorkerCardPinsEnabled ? 1 : 0,
      systemSettings.inactiveSessionTimeLimitMinutes,
      systemSettings.numIncorrectPinAttemptsAllowedBeforeCardLockout,
      systemSettings.overallSessionTimeLimitHours,
      systemSettings.startingCardLockoutDurationSeconds
    );
  }

  /**
   * Gets system settings or undefined if they aren't loaded yet
   */
  getSystemSettings(): SystemSettings | undefined {
    const result = this.client.one(
      `
      select
        are_poll_worker_card_pins_enabled as arePollWorkerCardPinsEnabled,
        inactive_session_time_limit_minutes as inactiveSessionTimeLimitMinutes,
        num_incorrect_pin_attempts_allowed_before_card_lockout as numIncorrectPinAttemptsAllowedBeforeCardLockout,
        overall_session_time_limit_hours as overallSessionTimeLimitHours,
        starting_card_lockout_duration_seconds as startingCardLockoutDurationSeconds
      from system_settings
      `
    ) as SystemSettingsDbRow | undefined;

    if (!result) {
      return undefined;
    }
    return {
      ...result,
      arePollWorkerCardPinsEnabled: result.arePollWorkerCardPinsEnabled === 1,
    };
  }
}
