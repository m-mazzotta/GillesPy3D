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

import os
import pickle
import shutil
import tempfile
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

        domain = mock.Mock()
        domain.coordinates.return_value = np.array([
            [-4.0, 0.0, 0.0],
            [4.0, 0.0, 0.0]
        ])
        results.model = mock.Mock()
        results.model.domain = domain

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
        self.assertEqual(timeseries["layout"]["yaxis"]["title"]["text"], "Molecules")
        self.assertIn("job_path", payload)
        self.assertIsNone(payload["job_path"])

        profile = payload["spatial_profile_figure"]
        self.assertIn("data", profile)
        self.assertEqual(len(profile["data"]), 3)
        self.assertEqual(profile["data"][0]["name"], "A")
        # First frame for A is [1, 2] at x=[-4, 4]; bins keep that left/right sum.
        self.assertAlmostEqual(sum(profile["data"][0]["y"]), 3)
        self.assertEqual(profile["data"][1]["name"], "B")
        self.assertAlmostEqual(sum(profile["data"][1]["y"]), 1)
        self.assertIn("Time = 0", profile["layout"]["title"]["text"])
        self.assertEqual(profile["layout"]["yaxis"]["title"]["text"], "Molecules")

        mid_profile = payload["spatial_profile_mid_figure"]
        self.assertIn("data", mid_profile)
        self.assertEqual(len(mid_profile["data"]), 3)
        # Mid frame for A is [3, 1] at x=[-4, 4].
        self.assertAlmostEqual(sum(mid_profile["data"][0]["y"]), 4)
        self.assertAlmostEqual(sum(mid_profile["data"][1]["y"]), 2)
        self.assertIn("Summarized", mid_profile["layout"]["title"]["text"])
        self.assertIn("t =", mid_profile["layout"]["title"]["text"])

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
        domain = mock.Mock()
        domain.coordinates.return_value = np.array([[0.0, 0.0, 0.0]])
        results.model = mock.Mock()
        results.model.domain = domain

        with mock.patch("os.listdir", return_value=["0", "1"]):
            payload = sim.run(preview=True)

        self.assertIn("data", payload)
        self.assertIn("layout", payload)
        self.assertNotIn("figures", payload)
        self.assertIn("timeseries_figure", payload)
        self.assertIn("spatial_profile_figure", payload)
        self.assertIn("spatial_profile_mid_figure", payload)
        self.assertEqual(len(payload["timeseries_figure"]["data"]), 2)
        self.assertEqual(len(payload["spatial_profile_figure"]["data"]), 2)
        self.assertEqual(len(payload["spatial_profile_mid_figure"]["data"]), 2)
        results.plot_species.assert_called_once()
        self.assertEqual(results.plot_species.call_args.kwargs["species"], "A")
        self.assertIn("job_path", payload)
        self.assertIsNone(payload["job_path"])


class TestPersistPreviewExportJob(unittest.TestCase):
    '''Preview runs can materialize a sibling job for CSV/notebook export.'''

    def test_persist_creates_job_and_results_pickle(self):
        with tempfile.TemporaryDirectory() as tmp:
            SpatialSimulation.user_dir = tmp
            model_rel = os.path.join("models", "demo.smdl")
            model_full = os.path.join(tmp, model_rel)
            os.makedirs(os.path.dirname(model_full), exist_ok=True)
            with open(model_full, "w", encoding="utf-8") as model_file:
                model_file.write("{}")

            fake_results = {"ok": True}

            def create_job(path, new=False, data=None):
                job_full = os.path.join(tmp, path)
                os.makedirs(os.path.join(job_full, "results"), exist_ok=True)
                shutil.copyfile(
                    os.path.join(tmp, data["mdl_path"]),
                    os.path.join(job_full, os.path.basename(data["mdl_path"]))
                )
                return mock.Mock()

            with mock.patch(
                "model_builder.handlers.util.spatial_simulation.GillesPy3DJob",
                side_effect=create_job
            ):
                job_path = SpatialSimulation.persist_preview_export_job(
                    model_rel, fake_results
                )

            self.assertEqual(job_path, os.path.join("models", "demo_SES_preview.wkfl"))
            results_path = os.path.join(tmp, job_path, "results", "results.p")
            self.assertTrue(os.path.exists(results_path))
            with open(results_path, "rb") as results_file:
                self.assertEqual(pickle.load(results_file), fake_results)


if __name__ == "__main__":
    unittest.main()
