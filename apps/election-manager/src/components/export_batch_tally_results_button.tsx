import React, { useContext, useState } from 'react';
import { Button } from '@votingworks/ui';
import { generateBatchResultsDefaultFilename } from '@votingworks/utils';
import { strict as assert } from 'assert';
import { SaveFileToUSB, FileType } from './save_file_to_usb';
import { AppContext } from '../contexts/app_context';
import { generateBatchTallyResultsCSV } from '../utils/generate_batch_tally_results_csv';

export function ExportBatchTallyResultsButton(): JSX.Element {
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const {
    fullElectionTally,
    castVoteRecordFiles,
    electionDefinition,
  } = useContext(AppContext);
  assert(electionDefinition);
  const isTestMode = castVoteRecordFiles?.fileMode === 'test';
  const { election } = electionDefinition;

  const defaultFilename = generateBatchResultsDefaultFilename(
    isTestMode,
    election
  );
  return (
    <React.Fragment>
      <Button small onPress={() => setIsSaveModalOpen(true)}>
        Export Batch Results as CSV
      </Button>
      {isSaveModalOpen && (
        <SaveFileToUSB
          onClose={() => setIsSaveModalOpen(false)}
          generateFileContent={async () =>
            generateBatchTallyResultsCSV(fullElectionTally, election)
          }
          defaultFilename={defaultFilename}
          fileType={FileType.BatchResultsCSV}
        />
      )}
    </React.Fragment>
  );
}