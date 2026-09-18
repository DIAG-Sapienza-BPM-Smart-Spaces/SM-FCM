import copy
import contextlib
import io
import json
from pathlib import Path
import random
import unittest

import FLT_class
from FCM_class_tool import FCM
from GA_class_tool import ALGA_class
from server import app


class IntegrationTests(unittest.TestCase):
    def setUp(self):
        self.structure = json.loads((Path(__file__).parents[1] / 'src/single_file.json').read_text())
        self.levels = [dict(id=n['id'], weight='M' if n['role'] == 'final' else 'NA', enabled=True)
                       for n in self.structure['nodes']]
        self.flt = FLT_class.define_al_fuzzy()

    def test_iteration_limit_and_input_immutability(self):
        original = copy.deepcopy(self.structure)
        fcm = FCM(2, self.structure, self.levels, self.flt)
        fcm.run_fcm(threshold=0)
        self.assertEqual(self.structure, original)
        for graph in fcm.model_out.values():
            for node in graph.nodes:
                self.assertEqual(len(graph.nodes[node]['attr_dict']['value']), 3)
        self.assertTrue(0 <= fcm.main_final_al <= 1)

    def test_converged_iteration_is_complete_and_retained(self):
        fcm = FCM(2, self.structure, self.levels, self.flt)
        fcm.run_fcm(threshold=2)
        for graph in fcm.model_out.values():
            for node in graph.nodes:
                values = graph.nodes[node]['attr_dict']['value']
                self.assertEqual(len(values), 2)
                self.assertGreater(values[-1], 0)

    def test_numeric_and_linguistic_inputs_agree(self):
        numeric = copy.deepcopy(self.levels)
        for node in numeric:
            node['weight'] = self.flt.get_value(node['weight'])
        a = FCM(100, self.structure, self.levels, self.flt)
        b = FCM(100, self.structure, numeric, self.flt, number_used=True)
        a.run_fcm()
        b.run_fcm()
        self.assertEqual(a.main_final_al, b.main_final_al)

    def test_ga_result_can_be_replayed(self):
        random.seed(17)
        original = copy.deepcopy(self.structure)
        ga = ALGA_class(2, 4, 3, 25, 'H', self.structure, self.levels, self.flt)
        with contextlib.redirect_stdout(io.StringIO()):
            results, populations, _ = ga.what_if()
        best = ga.find_best_individual(results, populations)
        replay = FCM(100, self.structure, best.activation_level, self.flt)
        replay.run_fcm()
        self.assertEqual(best.algorithm.result, replay.main_final_al)
        self.assertEqual(self.structure, original)

    def test_endpoints_use_request_and_preserve_response_shape(self):
        client = app.test_client()
        payload = dict(structure=self.structure, activation_level=self.levels, global_weight='H')
        response = client.post('/inference', json=payload)
        self.assertEqual(response.status_code, 200, response.json)
        self.assertIn('nodes', response.json['graphData'])
        old_config = dict(app.config)
        try:
            app.config.update(GA_RUNS=2, GA_POP_SIZE=4, GA_GENERATIONS=3)
            with contextlib.redirect_stdout(io.StringIO()):
                response = client.post('/simulation', json=payload)
            self.assertEqual(response.status_code, 200, response.json)
            self.assertEqual(len(response.json['graphData']), 2)
            for solution in response.json['solutions']:
                self.assertEqual(solution['target'], 0.7)
                replay = client.post('/inference', json=dict(structure=self.structure, activation_level=solution['activation_level']))
                root = next(n for n in replay.json['graphData']['nodes'] if n['role'] == 'root')
                self.assertAlmostEqual(root['numeric_weight'], solution['maturity'])
        finally:
            app.config.update(old_config)

    def test_invalid_requests_return_400(self):
        client = app.test_client()
        for route in ['/inference', '/simulation']:
            self.assertEqual(client.post(route, json={}).status_code, 400)
            self.assertEqual(client.post(route, data='{', content_type='application/json').status_code, 400)
            levels = copy.deepcopy(self.levels)
            for node in levels:
                node['enabled'] = False
            response = client.post(route, json=dict(structure=self.structure, activation_level=levels, global_weight='H'))
            self.assertEqual(response.status_code, 400, response.json)


if __name__ == '__main__':
    unittest.main()
