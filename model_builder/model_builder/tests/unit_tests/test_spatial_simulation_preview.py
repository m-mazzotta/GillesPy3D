'''
GillesPy3D is a platform for simulating biochemical systems
Copyright (C) 2025 GillesPy3D developers.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
'''

import unittest
from unittest import mock

from model_builder.handlers.util.spatial_simulation import SpatialSimulation


class TestSpatialSimulationAllSpeciesPreview(unittest.TestCase):
    '''Preview runs can return one figure per species from a single result.'''

    def test_all_species_returns_figures_map(self):
        sim = SpatialSimulation.__new__(SpatialSimulation)
        sim.target = "__all_species__"
        sim.s_model = {
            "defaultMode": "discrete",
            "species": [{"name": "A"}, {"name": "B"}, {"name": "C"}]
        }
        sim.s_py_model = mock.Mock()
        results = mock.Mock()
        results.result_dir = "/tmp/fake-results"
        sim.s_py_model.run.return_value = results

        figures = {
            "A": {"data": [{"name": "A"}], "layout": {}},
            "B": {"data": [{"name": "B"}], "layout": {}},
            "C": {"data": [{"name": "C"}], "layout": {}}
        }

        def plot_species(species, **_kwargs):
            return {
                "data": figures[species]["data"],
                "layout": dict(figures[species]["layout"])
            }

        results.plot_species.side_effect = plot_species

        import numpy as np
        timespan = mock.Mock()
        timespan.items = np.array([0.0, 1.0, 2.0])
        results.get_timespan.return_value = timespan

        def get_species(name, **_kwargs):
            if name == "A":
                return np.array([[1, 2], [3, 1], [2, 2]])
            if name == "B":
                return np.array([[0, 1], [2, 0], [1, 1]])
            return np.array([[0, 0], [1, 2], [3, 3]])

        results.get_species.side_effect = get_species

        with mock.patch("os.listdir", return_value=[".gitignore", "0", "1", "2"]):
            payload = sim.run(preview=True)

        sim.s_py_model.run.assert_called_once_with()
        self.assertEqual(results.plot_species.call_count, 3)
        for call in results.plot_species.call_args_list:
            self.assertEqual(call.kwargs.get("t_ndx_list"), [0, 1, 2])
        self.assertEqual(payload["species"], ["A", "B", "C"])
        self.assertEqual(set(payload["figures"].keys()), {"A", "B", "C"})
        for name in ("A", "B", "C"):
            self.assertTrue(payload["figures"][name]["layout"]["autosize"])
            self.assertIn("config", payload["figures"][name])

        timeseries = payload["timeseries_figure"]
        self.assertIn("data", timeseries)
        self.assertEqual(len(timeseries["data"]), 3)
        self.assertEqual(timeseries["data"][0]["name"], "A")
        self.assertEqual(timeseries["data"][0]["y"], [3, 4, 4])
        self.assertEqual(timeseries["data"][2]["y"], [0, 3, 6])
        self.assertEqual(timeseries["layout"]["yaxis"]["title"]["text"], "Count")

    def test_single_species_still_returns_one_figure(self):
        sim = SpatialSimulation.__new__(SpatialSimulation)
        sim.target = "A"
        sim.s_model = {
            "defaultMode": "discrete",
            "species": [{"name": "A"}, {"name": "B"}]
        }
        sim.s_py_model = mock.Mock()
        results = mock.Mock()
        results.result_dir = "/tmp/fake-results"
        sim.s_py_model.run.return_value = results
        results.plot_species.return_value = {"data": [], "layout": {}}

        import numpy as np
        timespan = mock.Mock()
        timespan.items = np.array([0.0, 1.0])
        results.get_timespan.return_value = timespan
        results.get_species.side_effect = lambda name, **_kwargs: np.array([[1], [2]])

        with mock.patch("os.listdir", return_value=["0", "1"]):
            payload = sim.run(preview=True)

        self.assertIn("data", payload)
        self.assertIn("layout", payload)
        self.assertNotIn("figures", payload)
        self.assertIn("timeseries_figure", payload)
        self.assertEqual(len(payload["timeseries_figure"]["data"]), 2)
        results.plot_species.assert_called_once()
        self.assertEqual(results.plot_species.call_args.kwargs["species"], "A")


if __name__ == "__main__":
    unittest.main()
