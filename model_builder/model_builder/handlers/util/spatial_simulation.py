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
            y_label = "Count"

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
                    "timeseries_figure": self.__plot_species_timeseries(results, species)
                }
            species = [entry['name'] for entry in self.s_model['species']]
            spatial_figure = self.__plot_preview_target(results, self.target, kwargs)
            spatial_figure["timeseries_figure"] = self.__plot_species_timeseries(
                results, species
            )
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
