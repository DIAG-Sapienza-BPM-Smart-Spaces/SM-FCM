from copy import deepcopy

from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.exceptions import BadRequest, UnsupportedMediaType
from FCM_class_tool import FCM
from GA_class_tool import ALGA_class
import FLT_class

app = Flask(__name__)
CORS(app, origins=['http://localhost:3000'])
app.config.update(GA_RUNS=2, GA_POP_SIZE=50, GA_GENERATIONS=250, GA_RETAIN=15)


def read_model_request():
    data = request.get_json()
    if not isinstance(data, dict):
        raise ValueError("Request body must be a JSON object")
    structure = data.get('structure')
    activation_level = data.get('activation_level')
    if not isinstance(structure, dict) or not isinstance(structure.get('nodes'), list) or not isinstance(structure.get('transitions'), list):
        raise ValueError("structure must contain nodes and transitions arrays")
    if not isinstance(activation_level, list):
        raise ValueError("activation_level must be an array")
    ids = [node['id'] for node in structure['nodes']]
    if len(set(ids)) != len(ids):
        raise ValueError("Node IDs must be unique")
    if sum(node['role'] == 'root' for node in structure['nodes']) != 1:
        raise ValueError("Exactly one root node is required")
    levels = {node['id']: node for node in activation_level}
    if len(levels) != len(activation_level) or not set(ids).issubset(levels):
        raise ValueError("Provide one activation level for every node")
    for node in structure['nodes']:
        if node['role'] not in ('root', 'intermediate', 'final'):
            raise ValueError("Unknown node role")
        if node['role'] == 'intermediate' and not isinstance(levels[node['id']].get('enabled'), bool):
            raise ValueError("Intermediate nodes require a boolean enabled flag")
    for edge in structure['transitions']:
        if edge['from'] not in levels or edge['to'] not in levels or edge['from'] not in ids or edge['to'] not in ids:
            raise ValueError("Transitions must reference existing nodes")
    return data, structure, activation_level


def graph_result(structure, fcm):
    graph = deepcopy(structure)
    values = {node['id']: node for node in fcm.generate_al_values()}
    for node in graph['nodes']:
        if node['id'] in values:
            result = values[node['id']]
            node.update(weight=result['weight'], numeric_weight=result['numeric_weight'])
    return graph


@app.route('/inference', methods=['POST'])
def execute_python():
    try:
        _, structure, activation_level = read_model_request()
        fcm = FCM(100, structure, activation_level, FLT_class.define_al_fuzzy())
        fcm.run_fcm()
        return jsonify(message='Script executed successfully', graphData=graph_result(structure, fcm))
    except (ValueError, KeyError, TypeError, StopIteration, BadRequest, UnsupportedMediaType) as error:
        return jsonify(error=str(error)), 400
    except Exception:
        app.logger.exception("Inference failed")
        return jsonify(error="Inference failed"), 500


@app.route('/simulation', methods=['POST'])
def execute_simulation():
    try:
        data, structure, activation_level = read_model_request()
        target = data.get('global_weight')
        if target is None or target == 'NA':
            raise ValueError("Select a target maturity level")
        ga = ALGA_class(
            app.config['GA_RUNS'], app.config['GA_POP_SIZE'],
            app.config['GA_GENERATIONS'], app.config['GA_RETAIN'],
            target, structure, activation_level, FLT_class.define_al_fuzzy())
        _, populations, _ = ga.what_if()
        best = [population.individuals[0] for population in populations]
        return jsonify(
            message=f'Simulation completed: target reached in {sum(individual.fitness_val < 0.03 for individual in best)}/{len(best)} solutions',
            graphData=[graph_result(structure, individual.algorithm.fcm) for individual in best],
            solutions=[dict(activation_level=individual.activation_level,
                            maturity=individual.algorithm.result,
                            target=ga.target_val,
                            target_reached=individual.fitness_val < 0.03)
                       for individual in best])
    except (ValueError, KeyError, TypeError, StopIteration, BadRequest, UnsupportedMediaType) as error:
        return jsonify(error=str(error)), 400
    except Exception:
        app.logger.exception("Simulation failed")
        return jsonify(error="Simulation failed"), 500


if __name__ == '__main__':
    app.run(debug=True)
