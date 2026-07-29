#!/usr/bin/env python3

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
import time
import argparse
import importlib
import runpy
import sys
from pathlib import Path

import plotly


def get_parsed_args():
    parser = argparse.ArgumentParser(description="Run spatial mockup simulation.")
    parser.add_argument(
        "--density",
        default="low",
        choices=("low", "medium", "high"),
        help="Mockup density; selects which notebook-export script to run.",
    )
    parser.add_argument(
        "--reaction-count",
        type=int,
        default=1,
        choices=(1, 2, 3),
        help="Number of low-density reactions (1=A, 2=A+B, 3=A+B+C).",
    )
    parser.add_argument(
        "--species",
        default="A",
        choices=("A", "B", "C"),
        help="Initial species to show (multi-reaction modes return figures for all).",
    )
    parser.add_argument(
        "--script",
        default=None,
        help="Override: path to a notebook-export .py under jupyterhub/ (optional).",
    )
    return parser.parse_args()


def _repo_root():
    return Path(__file__).resolve().parents[4]


def _script_path_for_density(density):
    """
    Map mockup slider density to the same notebook-export scripts as in Jupyter.

    low    -> spherevar1(1).py (runs model live)
    medium -> spherevar2.py (notebook export; may load pickled results — see that file)
    high   -> spherevar3.py
    """
    root = _repo_root() / "jupyterhub"
    mapping = {
        "low": root / "spherevar1(1).py",
        "medium": root / "spherevar2.py",
        "high": root / "spherevar3.py",
    }
    return mapping.get(density, mapping["low"])


def _script_path_for_run(density, reaction_count, script_override):
    """
    Resolve script path. Extra reactions only apply when density is low.
    """
    if script_override:
        return Path(script_override).resolve()
    if density == "low":
        if reaction_count >= 3:
            return _repo_root() / "jupyterhub" / "lowdensity_abc_reactions.py"
        if reaction_count >= 2:
            return _repo_root() / "jupyterhub" / "lowdensity_ab_reactions.py"
    return _script_path_for_density(density)


def _species_for_script(script_path):
    name = Path(script_path).name
    if name == "lowdensity_abc_reactions.py":
        return ["A", "B", "C"]
    if name == "lowdensity_ab_reactions.py":
        return ["A", "B"]
    return ["A"]


def _iter_plot_species_classes():
    """Yield SpatialPy classes that define plot_species (SpatialPy 1.x)."""
    import spatialpy  # pylint: disable=import-outside-toplevel

    seen = set()
    module_names = (
        "spatialpy.core.results",
        "spatialpy.core.result",
    )
    for mod_name in module_names:
        try:
            mod = importlib.import_module(mod_name)
        except ImportError:
            continue
        for obj in vars(mod).values():
            if isinstance(obj, type) and obj not in seen and hasattr(obj, "plot_species"):
                seen.add(obj)
                yield obj

    for attr in dir(spatialpy):
        try:
            obj = getattr(spatialpy, attr)
        except Exception:  # pylint: disable=broad-except
            continue
        if isinstance(obj, type) and obj not in seen and hasattr(obj, "plot_species"):
            seen.add(obj)
            yield obj


def _patch_plot_species_capture():
    """
    Notebook exports call plot_species(..., animated=True) without return_plotly_figure.
    Jupyter shows the return value via IPython display; a subprocess has no display.
    Inject return_plotly_figure=True and stash the figure for JSON serialization.
    """
    captured = {"figure": None}
    patched = []

    def wrap(orig):
        def plot_species(self, *args, **kwargs):
            kwargs = dict(kwargs)
            kwargs.setdefault("return_plotly_figure", True)
            out = orig(self, *args, **kwargs)
            if out is not None:
                captured["figure"] = out
            return out

        return plot_species

    for cls in _iter_plot_species_classes():
        orig = cls.plot_species
        cls.plot_species = wrap(orig)
        patched.append((cls, orig))

    return captured, patched


def _restore_plot_species(patched):
    for cls, orig in patched:
        cls.plot_species = orig


def _serialize_figure(raw_figure):
    if raw_figure is None:
        return None
    try:
        figure = json.loads(json.dumps(raw_figure, cls=plotly.utils.PlotlyJSONEncoder))
        figure["config"] = {"responsive": True, "displayModeBar": True}
        return figure
    except Exception:  # pylint: disable=broad-except
        return None


def _trajectory_from_results(results):
    if results is None:
        return None
    return results[0] if len(results) > 0 else results


def _plot_species_figure(trajectory, species_name):
    if trajectory is None:
        return None
    raw = trajectory.plot_species(
        species_name,
        animated=True,
        width="auto",
        height="auto",
    )
    return _serialize_figure(raw)


def _build_species_figures(globs, captured_from_script, species_names):
    """
    One multi-reaction run contains all requested species. Build a figure for
    each so the frontend can switch views without re-running the simulation.
    """
    trajectory = _trajectory_from_results(globs.get("results"))
    figures = {}

    for idx, species_name in enumerate(species_names):
        if idx == 0:
            # Script usually ends with plot_species('A'); reuse when present.
            fig = _serialize_figure(captured_from_script)
            if fig is None:
                fig = _plot_species_figure(trajectory, species_name)
        else:
            fig = _plot_species_figure(trajectory, species_name)
        if fig is not None:
            figures[species_name] = fig

    return figures


def run_spatial_mockup_simulation(density, script_path, species="A", reaction_count=1):
    import spatialpy  # noqa: F401, pylint: disable=import-outside-toplevel
    import io
    import warnings

    script_path = Path(script_path).resolve()
    if not script_path.is_file():
        raise FileNotFoundError(f"Simulation script not found: {script_path}")

    species_names = _species_for_script(script_path)
    multi_species = len(species_names) > 1
    captured, patched = _patch_plot_species_capture()
    start = time.time()

    # Keep stdout clean for the parent handler (Plotly/SpatialPy can print non-JSON).
    stdout_buf = io.StringIO()
    stderr_buf = io.StringIO()
    old_stdout, old_stderr = sys.stdout, sys.stderr
    try:
        sys.stdout = stdout_buf
        sys.stderr = stderr_buf
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            globs = runpy.run_path(str(script_path), run_name="__main__")
            if multi_species:
                figures = _build_species_figures(globs, captured["figure"], species_names)
            else:
                figures = {}
                figure = _serialize_figure(captured["figure"])
                if figure is not None:
                    figures["A"] = figure
    finally:
        sys.stdout = old_stdout
        sys.stderr = old_stderr
        _restore_plot_species(patched)

    elapsed_seconds = round(time.time() - start, 3)

    if multi_species:
        species_list = list(figures.keys()) or list(species_names)
        selected = species if species in figures else (species_list[0] if species_list else "A")
        figure = figures.get(selected)
    else:
        figure = figures.get("A")
        selected = "A"
        species_list = ["A"]

    model = globs.get("model")
    results = globs.get("results")
    model_name = getattr(model, "name", "spatial_mockup") if model is not None else "spatial_mockup"
    num_traj = len(results) if results is not None and hasattr(results, "__len__") else None

    return {
        "status": "success",
        "message": "Simulation completed.",
        "elapsed_seconds": elapsed_seconds,
        "model_name": model_name,
        "num_trajectories": num_traj,
        "density": density,
        "species": species_list,
        "viewing_species": selected,
        "reaction_count": int(reaction_count),
        "dual_reactions": int(reaction_count) >= 2,
        "figure": figure,
        "figures": figures,
        "script": str(script_path),
    }


if __name__ == "__main__":
    args = get_parsed_args()
    script = str(_script_path_for_run(args.density, args.reaction_count, args.script))
    try:
        response = run_spatial_mockup_simulation(
            args.density,
            script,
            species=args.species,
            reaction_count=args.reaction_count,
        )
        # Emit only JSON on stdout for the API handler to parse.
        sys.stdout.write(json.dumps(response, cls=plotly.utils.PlotlyJSONEncoder))
        sys.stdout.write("\n")
        sys.stdout.flush()
    except Exception as error:  # pylint: disable=broad-except
        resp = {"status": "error", "message": str(error), "density": args.density}
        sys.stdout.write(json.dumps(resp))
        sys.stdout.write("\n")
        sys.stdout.flush()
        raise
