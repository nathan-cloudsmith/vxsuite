
import json, os, tempfile

from flask import Flask, send_from_directory, send_file, request
from werkzeug.utils import secure_filename

from . import SEMSinput
from . import SEMSoutput

# directory for all files (from env variable first)
FILES_DIR = os.getenv("MODULE_SEMS_CONVERTER_WORKSPACE") or os.path.join(os.path.dirname(os.path.realpath(__file__)), '..', 'election_files')

app = Flask(__name__)

# paths
ELECTION_FILES = {
    "inputFiles": [
        {"name": "SEMS main file", "accept": ".txt,text/plain", "path": None},
        {"name": "SEMS candidate mapping file", "accept": ".txt,text/plain", "path": None}
    ],
    "outputFiles": [
        {"name": "Vx Election Definition", "path": None}
    ]
}

RESULTS_FILES = {
    "inputFiles": [
        {"name": "Vx Election Definition", "accept": ".json,application/json", "path": None},
        {"name": "Vx CVRs", "accept": ".jsonl,application/jsonlines", "path": None}
    ],
    "outputFiles": [
        {"name": "SEMS Results", "path": None}
    ]
}

RESULT_TALLIES_FILES = {
    "inputFiles": [
        {"name": "Vx Election Definition", "accept": ".json,application/json", "path": None},
        {"name": "Vx Tallies", "accept": ".json,application/json", "path": None}
    ],
    "outputFiles": [
        {"name": "SEMS Results", "path": None}
    ]
}


def find_by_name(lst_of_obj, name):
    for obj in lst_of_obj:
        if obj['name'] == name:
            return obj

@app.route('/convert/election/files', methods=["GET"])
def election_filelist():
    return json.dumps(ELECTION_FILES)

@app.route('/convert/tallies/files', methods=["GET"])
def tallies_filelist():
    return json.dumps(RESULT_TALLIES_FILES)

def submitfile(request, file_list):
    the_file = request.files['file']
    the_name = request.form['name']

    the_entry = find_by_name(file_list['inputFiles'], the_name)
    if the_entry:
        the_path = os.path.join(FILES_DIR, the_name)
        the_file.save(the_path)
        the_entry['path'] = the_path

@app.route('/convert/election/submitfile', methods=["POST"])
def election_submitfile():
    submitfile(request, ELECTION_FILES)
    return json.dumps({"status": "ok"})

@app.route('/convert/tallies/submitfile', methods=["POST"])
def tallies_submitfile():
    submitfile(request, RESULT_TALLIES_FILES)
    return json.dumps({"status": "ok"})

@app.route('/convert/election/process', methods=["POST"])
def election_process():
    for f in ELECTION_FILES['inputFiles']:
        if not f['path']:
            return json.dumps({"status": "not all files are ready to process"})

    input_files = ELECTION_FILES['inputFiles']
    vx_election = SEMSinput.process_election_files(
        find_by_name(input_files, 'SEMS main file')['path'],
        find_by_name(input_files, 'SEMS candidate mapping file')['path']
    )

    file_name = 'Vx Election Definition'
    the_path = os.path.join(FILES_DIR, file_name)
    vx_file = open(the_path, "w")
    vx_file.write(json.dumps(vx_election, indent=2))
    vx_file.close()

    the_output_file = find_by_name(ELECTION_FILES['outputFiles'], file_name)
    the_output_file['path']= the_path
    
    return json.dumps({"status": "ok"})

@app.route('/convert/election/output', methods=["GET"])
def election_output():
    the_name = request.args.get('name', None)
    the_entry = find_by_name(ELECTION_FILES['outputFiles'], the_name)

    if the_entry and the_entry['path']:
        return send_file(the_entry['path'])
    else:
        return "", 404

@app.route('/convert/tallies/process', methods=["POST"])
def tallies_process():
    for f in RESULT_TALLIES_FILES['inputFiles']:
        if not f['path']:
            return json.dumps({"status": "not all files are ready to process"})

    sems_result = SEMSoutput.process_tallies_file(
        find_by_name(RESULT_TALLIES_FILES['inputFiles'], 'Vx Election Definition')['path'],
        find_by_name(RESULT_TALLIES_FILES['inputFiles'], 'Vx Tallies')['path']
    )
    the_path = os.path.join(FILES_DIR, 'SEMS Results')
    result_file = open(the_path, "w")
    result_file.write(sems_result)
    result_file.close()

    find_by_name(RESULT_TALLIES_FILES['outputFiles'], 'SEMS Results')['path'] = the_path

    return json.dumps({"status": "ok"})
    
    
@app.route('/convert/tallies/output', methods=["GET"])
def tallies_output():
    the_name = request.args.get('name', None)
    the_entry = find_by_name(RESULT_TALLIES_FILES['outputFiles'], the_name)

    if the_entry and the_entry['path']:
        return send_file(the_entry['path'])
    else:
        return "", 404

@app.route('/convert/reset', methods=["POST"])
def convert_reset():
    reset()
    return json.dumps({"status": "ok"})

@app.route('/')
def index_test(): # pragma: no cover this is just for testing
    return send_from_directory(os.path.join(os.path.dirname(os.path.realpath(__file__)), '..'), 'index.html')

def reset():
    for category in [ELECTION_FILES, RESULTS_FILES, RESULT_TALLIES_FILES]:
        for file_list in [category['inputFiles'], category['outputFiles']]:
            for f in file_list:
                the_path = os.path.join(FILES_DIR, f['name'])
                if os.path.isfile(the_path):
                    os.remove(the_path)
                f['path'] = None
                
# on startup, reset everything
reset()
