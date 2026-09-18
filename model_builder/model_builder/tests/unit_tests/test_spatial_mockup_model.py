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

import json
import os
import tempfile
import unittest
from unittest import mock

from model_builder.handlers.models import SpatialMockupModelAPIHandler
from model_builder.handlers.util.model_builder_spatial_model import GillesPy3DSpatialModel


def _minimal_model():
    return {
        "is_spatial": True,
        "domain": {"shapes": []},
        "species": [{"name": "A"}],
        "parameters": [{"name": "P"}],
        "reactions": [{"name": "r1"}],
        "modelSettings": {"endSim": 20, "timeStep": 1, "timestepSize": 0.05}
    }


class TestSpatialMockupRelativePath(unittest.TestCase):
    '''Path validation for spatial mockup .smdl saves.'''

    def test_valid_simple_folder(self):
        path = SpatialMockupModelAPIHandler._get_relative_path("MyModel", "SpatialMockupModels")
        self.assertEqual(path, os.path.join("SpatialMockupModels", "MyModel.smdl"))

    def test_valid_nested_folder(self):
        path = SpatialMockupModelAPIHandler._get_relative_path("model_1", "Projects/Demo Models")
        self.assertEqual(path, os.path.join("Projects", "Demo Models", "model_1.smdl"))

    def test_rejects_invalid_name(self):
        for name in ("", "1bad", "has space", "../x", "a/b"):
            with self.subTest(name=name):
                with self.assertRaises(ValueError):
                    SpatialMockupModelAPIHandler._get_relative_path(name, "SpatialMockupModels")

    def test_rejects_path_traversal_folder(self):
        for folder in ("../escape", "ok/../bad", "/abs", "ok\\win", "", "ok/./sneaky"):
            with self.subTest(folder=folder):
                with self.assertRaises(ValueError):
                    SpatialMockupModelAPIHandler._get_relative_path("ValidName", folder)


class TestSpatialMockupValidateModel(unittest.TestCase):
    '''Structured model validation before writing .smdl.'''

    def test_requires_object(self):
        with self.assertRaises(ValueError):
            SpatialMockupModelAPIHandler._validate_model([], "x.smdl")

    def test_requires_spatial_flag_and_keys(self):
        with self.assertRaises(ValueError) as ctx:
            SpatialMockupModelAPIHandler._validate_model({"is_spatial": False}, "x.smdl")
        self.assertIn("missing", str(ctx.exception))

        model = _minimal_model()
        model["is_spatial"] = False
        with self.assertRaises(ValueError) as ctx:
            SpatialMockupModelAPIHandler._validate_model(model, "x.smdl")
        self.assertIn("spatial", str(ctx.exception).lower())

    def test_convert_to_spatialpy_success(self):
        with mock.patch.object(
            GillesPy3DSpatialModel, "convert_to_spatialpy", return_value=object()
        ) as convert:
            SpatialMockupModelAPIHandler._validate_model(_minimal_model(), "demo.smdl")
            convert.assert_called_once_with(include_model_settings=True)

    def test_convert_to_spatialpy_failure(self):
        with mock.patch.object(
            GillesPy3DSpatialModel, "convert_to_spatialpy", side_effect=RuntimeError("bad mesh")
        ):
            with self.assertRaises(ValueError) as ctx:
                SpatialMockupModelAPIHandler._validate_model(_minimal_model(), "demo.smdl")
            self.assertIn("validation failed", str(ctx.exception).lower())
            self.assertIn("bad mesh", str(ctx.exception))


class TestSpatialMockupSaveFlow(unittest.TestCase):
    '''Create / conflict / overwrite behavior using the handler path helpers.'''

    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.user_dir = self.tempdir.name
        self._prev_user_dir = GillesPy3DSpatialModel.user_dir
        GillesPy3DSpatialModel.user_dir = self.user_dir

    def tearDown(self):
        GillesPy3DSpatialModel.user_dir = self._prev_user_dir
        self.tempdir.cleanup()

    def _write_via_handler_logic(self, name, folder, model, overwrite):
        relative_path = SpatialMockupModelAPIHandler._get_relative_path(name, folder)
        user_dir = os.path.realpath(GillesPy3DSpatialModel.user_dir)
        full_path = os.path.realpath(os.path.join(user_dir, relative_path))
        if os.path.commonpath((user_dir, full_path)) != user_dir:
            raise ValueError("The save path must remain inside the user directory.")

        exists = os.path.exists(full_path)
        if exists and not overwrite:
            return {"status": "conflict", "path": relative_path, "code": 409}

        SpatialMockupModelAPIHandler._validate_model(model, relative_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        tmp_path = f"{full_path}.tmp"
        with open(tmp_path, "w", encoding="utf-8") as model_file:
            json.dump(model, model_file)
        os.replace(tmp_path, full_path)
        return {
            "status": "success",
            "path": relative_path,
            "created": not exists,
            "code": 200,
            "full_path": full_path
        }

    def test_create_then_conflict_then_overwrite(self):
        model = _minimal_model()
        with mock.patch.object(GillesPy3DSpatialModel, "convert_to_spatialpy", return_value=object()):
            first = self._write_via_handler_logic("Demo", "SpatialMockupModels", model, False)
            self.assertEqual(first["status"], "success")
            self.assertTrue(first["created"])
            self.assertTrue(os.path.exists(first["full_path"]))

            conflict = self._write_via_handler_logic("Demo", "SpatialMockupModels", model, False)
            self.assertEqual(conflict["status"], "conflict")
            self.assertEqual(conflict["code"], 409)

            model["annotation"] = "updated"
            overwritten = self._write_via_handler_logic(
                "Demo", "SpatialMockupModels", model, True
            )
            self.assertEqual(overwritten["status"], "success")
            self.assertFalse(overwritten["created"])
            with open(overwritten["full_path"], encoding="utf-8") as saved:
                self.assertEqual(json.load(saved)["annotation"], "updated")

    def test_path_stays_under_user_dir(self):
        relative_path = SpatialMockupModelAPIHandler._get_relative_path(
            "Safe", "SpatialMockupModels"
        )
        user_dir = os.path.realpath(self.user_dir)
        full_path = os.path.realpath(os.path.join(user_dir, relative_path))
        self.assertEqual(os.path.commonpath((user_dir, full_path)), user_dir)


CYLINDER_DOMAIN_PATH = os.path.join(
    os.path.dirname(__file__), "../../../client/cylinder-domain-template.json"
)


class TestCylinderDomainValidation(unittest.TestCase):
    '''Reference cylinder mesh validates through the spatial mockup save path.'''

    def test_baked_cylinder_domain_validates(self):
        with open(CYLINDER_DOMAIN_PATH, encoding="utf-8") as domain_file:
            domain = json.load(domain_file)
        model = _minimal_model()
        model["is_spatial"] = True
        model["domain"] = domain

        with mock.patch.object(
            GillesPy3DSpatialModel, "convert_to_spatialpy", return_value=object()
        ) as convert:
            SpatialMockupModelAPIHandler._validate_model(model, "cylinder.smdl")
            convert.assert_called_once_with(include_model_settings=True)

        self.assertEqual(len(domain["particles"]), 1059)
        self.assertEqual(domain["x_lim"], [-5, 5])


if __name__ == "__main__":
    unittest.main()
