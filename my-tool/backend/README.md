# Backend

Install the backend dependencies and start Flask from this directory:

```sh
python -m pip install -r requirements.txt
python server.py
```

Run the integration tests from the repository root:

```sh
python -m unittest discover -s my-tool/backend -p test_integration.py -v
```

`POST /inference` accepts `structure` and `activation_level`. Weights can be
linguistic terms or numbers between 0 and 1. At least one intermediate node
must be enabled.

`POST /simulation` also requires `global_weight`, a linguistic target or a
number between 0 and 1. It runs two GA searches and returns `graphData` as an
array, preserving the frontend response format. Each corresponding `solutions`
entry includes the proposed input `activation_level`, resulting `maturity`,
`target`, and `target_reached`. The input activation levels can be submitted
to `/inference` to reproduce the solution. The GA only proposes increases;
a requested target is not guaranteed to be reachable. Tolerance is 0.03 on
the fitness rounded to three decimal places.

The defaults are 2 runs, 50 individuals, 250 generations, and 15 percent
elitism. They are configured through the Flask `GA_RUNS`, `GA_POP_SIZE`,
`GA_GENERATIONS`, and `GA_RETAIN` configuration keys.

The root and backend copies of FCM_class_tool.py and GA_class_tool.py currently
share the same implementation; keep them aligned when changing either copy.
