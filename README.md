# FCM-based Maturity Model for Smart Manufacturing 

Implementation of a FCM-based Maturity Model for Smart Manufacturing focusing on IT systems and key enabling technologies as drivers. The map assesses (running the FCM) the level of smart manufacturing of a company to capture the current state of digitization (As Is) and to suggest (via Genetic Algorithm) paths for digital growth (To Be).

![map](images/map.png)

## Structure of the repository

```text
.
|-- my-tool/
|   |-- src/                       # React interface and graph definition
|   |-- backend/
|   |   |-- server.py              # Flask inference and simulation API
|   |   |-- FCM_class_tool.py      # FCM inference for the web tool
|   |   |-- GA_class_tool.py       # Genetic algorithm for the web tool
|   |   |-- FLT_class.py           # Fuzzy linguistic terms
|   |   |-- requirements.txt       # Backend dependencies
|   |   |-- test_integration.py    # FCM, GA and API regression tests
|   |   `-- README.md              # Backend details
|   `-- package.json              # React scripts and dependencies
|-- evaluation/                   # Research experiments and results
|-- model/                        # Research model definitions
|-- cases/                        # Company activation-level datasets
|-- utils/                        # Model utilities and expert responses
|-- config.json                   # Configuration for research scripts
|-- FCM_class.py                   # Original research inference
|-- GA_class.py                    # Original research genetic algorithm
|-- FLT_class.py                   # Research fuzzy linguistic terms
|-- FCM_class_tool.py              # Root copy of the web-tool FCM
|-- GA_class_tool.py               # Root copy of the web-tool GA
|-- requirements.txt              # Original research dependencies
`-- package.json                  # Shared visualization dependencies
```

## Run the web application

The application uses React at `http://localhost:3000` and Flask at
`http://localhost:5000`. Commands below start from the repository root.
You need Python, Node.js/npm, and optionally Conda for environment management.

### Start the backend

```shell
conda create -n pyfcm-tool python=3.12
conda activate pyfcm-tool
python -m pip install -r my-tool/backend/requirements.txt
python my-tool/backend/server.py
```

The backend requirements include Flask, Flask-Cors, and scikit-fuzzy 0.5.0.
Use this requirements file for the web application; the root requirements
retain the original research dependencies, including scikit-fuzzy 0.4.2,
which cannot be imported with Python 3.12.

### Start the frontend

In a second terminal, from the repository root:

```shell
npm install
cd my-tool
npm install
npm start
```

Both installation steps are needed because D3 is declared in the root
`package.json`, while React and its scripts are declared in `my-tool/package.json`.
Open `http://localhost:3000`. The frontend calls port 5000, and the backend
allows this frontend origin through CORS.

### Inference and simulation

1. Enable at least one IT-system section and assign activation levels to its technologies.
2. Select **Run Inference** to calculate the current maturity level.
3. Select a target maturity level and run the simulation to search for technology improvements.

Inference accepts linguistic weights (`NA`, `VL`, `L`, `M`, `H`, `VH`) or numeric
weights between 0 and 1 through the API. The interface requires technology
weights other than `NA` in enabled sections.

Simulation executes the genetic algorithm using the supplied activation levels
and target. It returns two candidate graphs rather than loading the example
`final_al1.json` and `final_al2.json` files. The GA proposes increases in technology
activation levels; a target is not guaranteed to be reached. The response message
reports how many candidates reach the target tolerance.

| Endpoint | Request fields | Response fields |
| --- | --- | --- |
| `POST /inference` | `structure`, `activation_level` | `message`, `graphData` (one graph) |
| `POST /simulation` | `structure`, `activation_level`, `global_weight` | `message`, `graphData` (array), `solutions` |

Each simulation solution includes the proposed input `activation_level`, resulting
`maturity`, `target`, and `target_reached`. Submit these activation levels to
`/inference` with the same structure to reproduce the result. Target attainment
uses a fitness below 0.03 after rounding the absolute error to three decimal places.
Invalid requests return HTTP 400.

Default GA settings are 2 runs, 50 individuals, 250 generations, and 15% elitism.
These are Flask configuration values in `my-tool/backend/server.py`. See the
[backend README](my-tool/backend/README.md) for configuration details.

### Run backend tests

With the backend environment active, from the repository root:

```shell
python -m unittest discover -s my-tool/backend -p test_integration.py -v
```

Tests cover iteration limits, complete converged updates, input immutability,
numeric and linguistic weights, reproducible GA results, and API responses.

The root and backend copies of `FCM_class_tool.py` and `GA_class_tool.py` currently
share the same implementation and must be kept aligned. The Flask server imports
the backend copies. The original `FCM_class.py` and `GA_class.py` remain the entry
points for the research workflows below.

## Set up the research scripts

- Install [Miniconda](https://docs.anaconda.com/free/miniconda/) or [Anaconda](https://www.anaconda.com/download) if you haven't already.

- Create a new conda environment:
    ```shell
    conda create -n pyfcm python=3.10
    conda activate pyfcm
    ```

- Install the dependencies:
    ```shell
    python -m pip install -r requirements.txt
    ```

## Run the research code

- Activate the conda environment:
    ```shell
    conda activate pyfcm
    ```

- Define the activation levels (AL) of each technology (node) inside the [cases](cases) folder - [follow below instructions](#define-al-for-a-new-case). Or use one of the cases already available `[low, medium, high, mix]`.

- Modify [config.json](config.json) as you wish. As an example:
    ```json
    {
        "case": "low",
        "target_val": "VH",
        "to_remove": []
    }
    ```
    `case` key refers to the company case to study (one of the folder in [cases](cases)), `target_val` refers to the target value to reach in the genetic algorithm (accepted values are `[VL, L, M, H, VH] = [very low, low, medium, high, very high]`) and `to_remove` refers to the set of IT systems to remove from the map (accepted values are `['CAD, CAM, PLM', 'CRM', 'ERP, SCM', 'WMS, TMS', 'MES']`).

- To run the FCM (inference analysis):
    ```shell
    python FCM_class.py
    ```


### Define AL for a new case

- Create a new folder in [cases](cases).
- Create five files `X_al.csv` for `X=[1,5]={1 = "CAD,CAM,PLM", 2="CRM", 3="ERP,SCM", 4="WMS,TMS", 5="MES"}` to define the AL of each technology of each IT system. Linguistic terms used are `[NA, VL, L, M, H, VH] = [neutral, very low, low, medium, high, very high]`. The concept linked to the main FCM, the one in $(row=0,column=0)$ must have `NA` value. Below an example:
    ```csv
    NA,0
    L,0
    M,0
    H,0
    L,0
    L,0
    M,0
    ```
    To check the technologies linked to each node, have a look at the `.json` files in [model](model).
- Put the files in the folder you created.

## How to run the experiments

#### Graph theory analyses
In order to show results of the graph theory analyses:
```shell
cd evaluation
python eval_structure.py
```

#### FCM inference analysis
In order to run and plot results of the FCM inference analyses:
```shell
cd evaluation
python eval_fcm.py
```
**N.B.** Results are also reported in this [notebook](evaluation/notebook_eval_fcm.ipynb).


#### GA analysis
In order to run and plot results of the GA analysis:
```shell
cd evaluation
python eval_ga.py
```
**N.B.** This [pickle](evaluation/ga_results/results.pkl) file stores results shown in the article and this [notebook](evaluation/notebook_eval_ga.ipynb) reports the outcome. The folder [ga_results](evaluation/ga_results) contains the values found by the GA.


## Case Study Results

The following are the original research results, not a regression baseline for the web tool.

Final activation level of each IT system:
```
Algorithm: Papageorgiou, Iterations: 100, Company Type: case_study
CAD, CAM, PLM (FCM1): 0.80205
CRM (FCM2): 0.74365
ERP, SCM (FCM3): 0.7686
WMS, TMS (FCM4): 0.2622
MES (FCM5): 0.72659
Smart Manufacturing maturity level: 0.660618
```

![map](images/case_study.png)

## Experts responses
Responses of the experts are here available: [link](utils/data/responses/).

## Final causal relationships
Causal relationships resulting from the questionnaires are here available: [link](utils/data/).


## License
Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
