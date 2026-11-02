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
import json
import pickle
import shutil
import logging
import traceback

import numpy
import plotly.graph_objects as go
from spatialpy import TimeSpan

from .model_builder_job import GillesPy3DJob
from .model_builder_errors import GillesPy3DJobResultsError

log = logging.getLogger("gillespy3d")

class SpatialSimulation(GillesPy3DJob):
    '''
    ################################################################################################
    GillesPy3D spatial ensemble simulation job object
    ################################################################################################
    '''

    TYPE = "spatial"

    def __init__(self, path, preview=False, target=None):
        '''
        Intitialize a spatial ensemble simulation job object

        Attributes
        ----------
        path : str
            Path to the spatial ensemble simulation job
        preview : bool
            Indicates whether or not the simulation is a preview.
        target : string
            Results data target used for ploting
        '''
        super().__init__(path=path)
        self.export_model_path = None
        if not preview:
            self.settings = self.load_settings()
            self.s_py_model, self.s_model = self.load_models()
        else:
            self.target = target


    def __get_run_settings(self):
        return self.get_run_settings(settings=self.settings, solver_map=None)

    @classmethod
    def __store_pickled_results(cls, results):
        try:
            with open('results/results.p', 'wb') as results_file:
                pickle.dump(results, results_file)
        except Exception as err:
            message = f"Error storing pickled results: {err}\n{traceback.format_exc()}"
            log.error(message)
            return message
        return False

    def __update_timespan(self):
        if "timespanSettings" in self.settings:
            keys = self.settings['timespanSettings'].keys()
            if "endSim" in keys and "timeStep" in keys and "timestepSize" in keys:
                end = self.settings['timespanSettings']['endSim']
                step_size = self.settings['timespanSettings']['timeStep']
                timestep_size = self.settings['timespanSettings']['timestepSize']
                self.s_py_model.timespan(
                    TimeSpan.arange(step_size, t=end + step_size, timestep_size=timestep_size)
                )

    def __plot_preview_target(self, results, target, kwargs):
        properties = ["type", "rho", "mass", "nu"]
        plot_kwargs = dict(kwargs)
        if target in properties or target.startswith("v["):
            property_name = target
            if target.startswith("v["):
                plot_kwargs['p_ndx'] = int(target[2])
                property_name = "v"
            plot = results.plot_property(
                property_name=property_name,
                **plot_kwargs
            )
        else:
            concentration = self.s_model['defaultMode'] == "discrete-concentration"
            deterministic = self.s_model['defaultMode'] == "continuous"
            plot = results.plot_species(
                species=target, concentration=concentration,
                deterministic=deterministic, **plot_kwargs
            )
        plot["layout"]["autosize"] = True
        plot["config"] = {"responsive": True, "displayModeBar": True}
        return plot

    @staticmethod
    def __format_time_label(value):
        try:
            number = float(value)
        except (TypeError, ValueError):
            return value
        if abs(number - round(number)) < 1e-9:
            return int(round(number))
        return round(number, 6)

    @classmethod
    def __format_time_labels(cls, times):
        return [cls.__format_time_label(value) for value in times]

    def __preview_frame_labels(self, results):
        '''
        Build animation slider labels from the model timespan (simulation time),
        not raw output-file indices.
        '''
        times = self.__timespan_to_list(results.get_timespan())
        try:
            entries = os.listdir(results.result_dir)
        except OSError:
            entries = []

        vtk_count = sum(
            1 for name in entries
            if name.startswith("output") and name.endswith(".vtk")
        )
        if vtk_count <= 0:
            # Some fixtures only expose a result-dir file count.
            vtk_count = max(len(entries) - 1, 0)

        if times:
            count = min(len(times), vtk_count) if vtk_count > 0 else len(times)
            return self.__format_time_labels(times[:count])
        if vtk_count > 0:
            return list(range(vtk_count))
        return [0]

    @staticmethod
    def __timespan_to_list(times, num_points=None):
        if hasattr(times, "items"):
            values = times.items
        elif hasattr(times, "tolist"):
            values = times
        else:
            values = numpy.asarray(list(times))

        if hasattr(values, "tolist"):
            values = values.tolist()
        else:
            values = list(values)

        if num_points is None:
            return values

        if len(values) == num_points:
            return values
        if len(values) > num_points:
            return values[:num_points]
        if len(values) >= 2:
            return numpy.linspace(
                float(values[0]), float(values[-1]), num_points
            ).tolist()
        end = float(values[0]) if values else float(max(num_points - 1, 0))
        return numpy.linspace(0.0, end, num_points).tolist()

    def __plot_species_timeseries(self, results, species_names):
        concentration = self.s_model['defaultMode'] == "discrete-concentration"
        deterministic = self.s_model['defaultMode'] == "continuous"
        figure = go.Figure()

        for name in species_names:
            species_data = results.get_species(
                name, concentration=concentration, deterministic=deterministic
            )
            totals = numpy.sum(species_data, axis=1)
            times = self.__timespan_to_list(
                results.get_timespan(),
                num_points=totals.shape[0]
            )
            if hasattr(totals, "tolist"):
                totals = totals.tolist()
            figure.add_trace(go.Scatter(
                x=times,
                y=totals,
                mode="lines",
                name=name
            ))

        if concentration:
            y_label = "Concentration"
        elif deterministic:
            y_label = "Deterministic value"
        else:
            y_label = "Molecules"

        figure.update_layout(
            title="Species totals over time",
            xaxis_title="Time",
            yaxis_title=y_label,
            autosize=True,
            legend={
                "orientation": "h",
                "yanchor": "bottom",
                "y": 1.02,
                "xanchor": "right",
                "x": 1
            }
        )
        plot = json.loads(figure.to_json())
        plot["layout"]["autosize"] = True
        plot["config"] = {"responsive": True, "displayModeBar": True}
        return plot

    @staticmethod
    def __domain_coordinates(results):
        domain = getattr(getattr(results, "model", None), "domain", None)
        if domain is None:
            return None
        if callable(getattr(domain, "coordinates", None)):
            coords = domain.coordinates()
        else:
            coords = getattr(domain, "vertices", None)
        if coords is None:
            return None
        return numpy.asarray(coords, dtype=float)

    @classmethod
    def __long_axis_index(cls, coords):
        extents = numpy.ptp(coords, axis=0)
        return int(numpy.argmax(extents))

    def __plot_species_spatial_profile(self, results, species_names, num_bins=40,
                                       time_mode="initial"):
        '''
        Population summed into bins along X.

        time_mode:
          - "initial": first frame (Time = 0)
          - "mid": middle frame summarized across the run
        '''
        concentration = self.s_model['defaultMode'] == "discrete-concentration"
        deterministic = self.s_model['defaultMode'] == "continuous"
        coords = self.__domain_coordinates(results)
        if coords is None or coords.size == 0:
            return {
                "data": [],
                "layout": {
                    "title": "Molecule Population Along x-axis",
                    "autosize": True
                },
                "config": {"responsive": True, "displayModeBar": True}
            }

        axis = 0
        positions = coords[:, axis]
        axis_label = "X"
        use_mid = time_mode == "mid"

        figure = go.Figure()
        snapshot_time = None
        for name in species_names:
            species_data = numpy.asarray(results.get_species(
                name, concentration=concentration, deterministic=deterministic
            ), dtype=float)
            times = self.__timespan_to_list(
                results.get_timespan(),
                num_points=1 if species_data.ndim == 1 else species_data.shape[0]
            )
            if species_data.ndim == 1:
                frame = species_data
                time_index = 0
            elif use_mid and species_data.shape[0] > 1 and times:
                # Closest output frame to half the run, for any end time length.
                target = float(times[-1]) / 2.0
                time_index = int(numpy.argmin([
                    abs(float(time_value) - target) for time_value in times
                ]))
                frame = species_data[time_index]
            else:
                time_index = 0
                frame = species_data[time_index] if species_data.ndim > 1 else species_data

            if snapshot_time is None:
                if times and time_index < len(times):
                    snapshot_time = self.__format_time_label(times[time_index])
                else:
                    snapshot_time = time_index

            if frame.shape[0] != positions.shape[0]:
                count = min(frame.shape[0], positions.shape[0])
                frame = frame[:count]
                pos = positions[:count]
            else:
                pos = positions

            hist, edges = numpy.histogram(
                pos, bins=num_bins, weights=frame
            )
            centers = 0.5 * (edges[:-1] + edges[1:])
            figure.add_trace(go.Scatter(
                x=centers.tolist(),
                y=hist.tolist(),
                mode="lines",
                name=name
            ))

        if concentration:
            y_label = "Concentration"
        elif deterministic:
            y_label = "Deterministic value"
        else:
            y_label = "Molecules"

        if use_mid:
            title = "Molecule Population Along x-axis (Summarized)"
            if snapshot_time is not None:
                title = f"{title} (t = {snapshot_time})"
        else:
            title = "Molecule Population Along x-axis at Time = 0"

        figure.update_layout(
            title=title,
            xaxis_title=f"Position ({axis_label})",
            yaxis_title=y_label,
            autosize=True,
            legend={
                "orientation": "h",
                "yanchor": "bottom",
                "y": 1.02,
                "xanchor": "right",
                "x": 1
            }
        )
        plot = json.loads(figure.to_json())
        plot["layout"]["autosize"] = True
        plot["config"] = {"responsive": True, "displayModeBar": True}
        return plot

    @classmethod
    def persist_preview_export_job(cls, model_path, results):
        '''
        Create or refresh a sibling spatial job so mockup previews can reuse the
        standard /job/csv and /workflow/notebook export endpoints.
        '''
        if not model_path:
            return None
        name = os.path.splitext(os.path.basename(model_path))[0]
        dirname = os.path.dirname(model_path)
        job_rel = os.path.join(dirname, f"{name}_SES_preview.wkfl") if dirname else \
            f"{name}_SES_preview.wkfl"
        job_full = os.path.join(cls.user_dir, job_rel)

        if not os.path.exists(job_full):
            GillesPy3DJob(
                path=job_rel,
                new=True,
                data={
                    "type": "spatial",
                    "mdl_path": model_path,
                    "settings": None,
                    "compute_env": "Local"
                }
            )
        else:
            src = os.path.join(cls.user_dir, model_path)
            if os.path.exists(src):
                shutil.copyfile(src, os.path.join(job_full, os.path.basename(model_path)))

        results_dir = os.path.join(job_full, "results")
        os.makedirs(results_dir, exist_ok=True)
        with open(os.path.join(results_dir, "results.p"), "wb") as results_file:
            pickle.dump(results, results_file)
        return job_rel

    def run(self, preview=False, verbose=False):
        '''
        Run a SpatialPy ensemble simulation job

        Attributes
        ----------
        preview : bool
            Indicates whether or not to run a ??? sec preivew
        verbose : bool
            Indicates whether or not to print debug statements
        '''
        if preview:
            if verbose:
                self.log("info", "Running a preview spatial ensemble simulation")
            results = self.s_py_model.run()
            job_path = None
            if self.export_model_path:
                try:
                    job_path = self.persist_preview_export_job(
                        self.export_model_path, results
                    )
                except Exception as err:  # pylint: disable=broad-except
                    log.warning("Could not persist preview export job: %s", err)
            t_ndx_list = self.__preview_frame_labels(results)
            kwargs = {"t_ndx_list": t_ndx_list, "animated": True, "width": "auto", "height": "auto",
                      "return_plotly_figure": True, "f_duration": 100, "t_duration": 100}
            if self.target == "__all_species__":
                species = [entry['name'] for entry in self.s_model['species']]
                figures = {
                    name: self.__plot_preview_target(results, name, kwargs)
                    for name in species
                }
                return {
                    "species": species,
                    "figures": figures,
                    "timeseries_figure": self.__plot_species_timeseries(results, species),
                    "spatial_profile_figure": self.__plot_species_spatial_profile(
                        results, species, time_mode="initial"
                    ),
                    "spatial_profile_mid_figure": self.__plot_species_spatial_profile(
                        results, species, time_mode="mid"
                    ),
                    "job_path": job_path
                }
            species = [entry['name'] for entry in self.s_model['species']]
            spatial_figure = self.__plot_preview_target(results, self.target, kwargs)
            spatial_figure["timeseries_figure"] = self.__plot_species_timeseries(
                results, species
            )
            spatial_figure["spatial_profile_figure"] = self.__plot_species_spatial_profile(
                results, species, time_mode="initial"
            )
            spatial_figure["spatial_profile_mid_figure"] = self.__plot_species_spatial_profile(
                results, species, time_mode="mid"
            )
            spatial_figure["job_path"] = job_path
            return spatial_figure
        if verbose:
            log.info("Running the spatial ensemble simulation")
        self.__update_timespan()
        kwargs = self.__get_run_settings()
        results = self.s_py_model.run(**kwargs)
        if verbose:
            log.info("The spatial ensemble simulation has completed")
            log.info("Storing the results as pickle")
        if not 'results' in os.listdir():
            os.mkdir('results')
        pkl_err = self.__store_pickled_results(results=results)
        if pkl_err:
            message = "An unexpected error occured with the result object"
            trace = str(pkl_err)
            raise GillesPy3DJobResultsError(message, trace)
        return None
