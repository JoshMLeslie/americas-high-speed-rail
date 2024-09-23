'use strict';
/* global L:readonly */

import { bindRegionButtonsToMap, setupBoundaryButtons } from './bind-btns.js';
import {
	HIDE_SOFT_REGION,
	INIT_ZOOM_LEVEL,
	PROD_CENTER,
	SHOW_SOFT_REGION,
	ZOOM_LEVEL,
} from './const/const.js';
import abbreviatedStateNames from './const/usa-states/abbreviated-state-names.mjs';
import abbreviatedStateToName from './const/usa-states/abbreviated-state-to-name.mjs';
import coords from './coords.js';
import genCountyHeatmap from './county-heatmap.js';
import { drawRegion } from './draw-region.js';
import { eHIDE_CITY_LABELS, eSHOW_CITY_LABELS } from './events.js';
import initAddressLookup from './interactions/address-lookup.js';
import initPingCoord from './interactions/ping-coord.js';
import genMajorCityMarkers from './mapping/major-city-markers.js';
import cloneLayer from './util/clone-layer.js';
import { fetchJSON, getBoundsForBox } from './util/index.js';
import CENTERS from './zones/centers.js';
import ZONE_NE from './zones/north-east.js';

const simpleDataCache = {
	majorCities: null,
	countyHeatmap: null,
};

const resetMapHUDZoom = mapHUD => {
	/** @type {DOMRect} */
	const mapHudBounds = mapHUD.getContainer().getBoundingClientRect();
	if (mapHudBounds.height <= 300 || mapHudBounds.width <= 300) {
		mapHUD.setZoom(1);
	} else {
		mapHUD.setZoom(2);
	}
};

/**
 * @returns [L.Map, L.Map] - base map and HUD map
 */
const initMaps = () => {
	const isProd = !/localhost|127.0.0.1/.test(location.href);
	document.querySelector('body').classList.add(isProd ? 'prod' : 'dev');

	let map;
	const mapOpts = {
		wasdKeyboard: true,
		loadingControl: true,
	};
	if (isProd) {
		map = L.map('map', {
			center: PROD_CENTER,
			zoom: INIT_ZOOM_LEVEL,
			...mapOpts,
		});
	} else {
		map = L.map('map', {
			center: CENTERS.NA,
			zoom: ZOOM_LEVEL.country,
			...mapOpts,
		});
	}

	// 	let lastZoom = INIT_ZOOM_LEVEL;
	// 	map.on('zoomend', (e) => {
	// 		// TODO route specificity relative to zoom level alike ClusterMarkers
	// 		const newZoom = e.target.getZoom()
	// 		const zoomDiff = newZoom - lastZoom;
	// 		console.log(e, lastZoom, newZoom, zoomDiff)
	// })

	const mapHUD = L.map('hud-map', {
		keyboard: false,
		center: PROD_CENTER,
		zoom: 2,
		// NO ZOOM! ONLY LOOK!
		zoomControl: false,
		interactive: false,
		doubleClickZoom: false,
		dragging: false,
		boxZoom: false,
		scrollWheelZoom: false,
		tap: false,
		touchZoom: false,
	});

	resetMapHUDZoom(mapHUD);

	L.control.scale().addTo(map);
	L.control.scale().addTo(mapHUD);

	return [map, mapHUD];
};

const initSupportDialog = () => {
	const helpDialog = document.querySelector('dialog#support-dialog');
	document.addEventListener('keydown', ({key}) => {
		if (key === '?') {
			helpDialog.showModal();
		}
	});
	document
		.querySelector('#support-dialog-open')
		.addEventListener('click', () => {
			helpDialog.showModal();
		});
	helpDialog.addEventListener('click', ({ctrlKey}) => {
		if (ctrlKey) {
			helpDialog.close();
		}
	});
	document
		.querySelector('#support-dialog-close')
		.addEventListener('click', () => {
			helpDialog.close();
		});
	// support dialog tab actions
	const supportDialogActions = document.querySelector(
		'#support-dialog_header_actions'
	);
	const supportDialogContent = document.querySelectorAll(
		'.support-dialog-content'
	);
	for (const action of supportDialogActions.children) {
		const tab = action.getAttribute('data-tab');
		action.onclick = () => {
			for (const action of supportDialogActions.children) {
				action.classList.remove('active');
			}
			action.classList.add('active');
			for (const content of supportDialogContent) {
				if (content.getAttribute('data-for-tab') === tab) {
					content.classList.remove('hidden');
				} else {
					content.classList.add('hidden');
				}
			}
		};
	}
};

const initSoftRegions = async map => {
	document.querySelector('#show-soft-regions').addEventListener('change', e => {
		if (!e.target.checked) {
			Object.values(softRegions).forEach(region => {
				map.removeLayer(region);
			});
		}
	});

	document.addEventListener(SHOW_SOFT_REGION, ({detail}) => {
		const softRegion = softRegions[detail];
		if (softRegion) {
			softRegion.addTo(map);
		} else {
			throw ReferenceError(`soft region DNE for '${detail}'`);
		}
	});
	document.addEventListener(HIDE_SOFT_REGION, ({detail}) => {
		const softRegion = softRegions[detail];
		if (map.hasLayer(softRegion)) {
			if (softRegion) {
				softRegion.removeFrom(map);
			} else {
				throw ReferenceError(`soft region DNE for '${detail}'`);
			}
		}
	});

	const softRegions = {};
	const data = await fetchJSON('./assets/js/zones/soft-regions.json');
	// todo figure out why L.geoJson(d) won't render
	data.features.forEach(f => {
		if (!f.geometry.coordinates[0].length) {
			return;
		}
		const poly = L.polygon(f.geometry.coordinates[0], {
			interactive: true,
		});
		poly.bindTooltip(`${f.properties.title} region`);
		softRegions[f.properties.region] = poly;
	});
};

/** data from https://gadm.org/download_country.html */
const loadGeojsonBounds = country => async useLayer => {
	const path = `/assets/js/geojson/${country}-state-bounds_${useLayer}.json`;
	return fetchJSON(path)
		.then(d =>
			L.geoJson(d, {
				style: () => ({opacity: 0.5, weight: 2, fill: false}),
			})
		)
		.catch(e => console.warn(e));
};
function initBoundaryButtons(map) {
	setupBoundaryButtons(map, {
		getCanada: loadGeojsonBounds('canada'),
		getUSA: loadGeojsonBounds('usa'),
		getMexico: loadGeojsonBounds('mexico'),
	});
}

const initMapHUDViewbox = (map, mapHUD) => {
	const viewBox = L.rectangle(getBoundsForBox(map), {
		interactive: true,
		draggable: true,
		zoomable: true,
		asDelta: false,
		zoom: INIT_ZOOM_LEVEL,
	});
	const viewBoxBackground = L.polygon(
		[getBoundsForBox(mapHUD), getBoundsForBox(viewBox)],
		{color: '#000000', className: 'no-click'}
	);
	viewBoxBackground.addTo(mapHUD);
	viewBox.addTo(mapHUD);

	viewBox.on('dragend', v => {
		const draggedTo = v.target.getCenter();
		map.setView(draggedTo);
	});
	viewBox.on('zoom', v => {
		map.setZoom(v.zoom);
	});

	const drawViewBox = () => {
		const mapBounds = getBoundsForBox(map);
		viewBox.setLatLngs(mapBounds);
		viewBoxBackground.setLatLngs([getBoundsForBox(mapHUD), mapBounds]);
	};

	map.on('moveend', drawViewBox);
	map.on('zoomend', drawViewBox);

	mapHUD.on('resize', e => {
		resetMapHUDZoom(e.sourceTarget);
		setTimeout(drawViewBox);
	});
};

let distancePointers = [];
let lastMeasurementLine = null;
const cleanupMeasurement = () => {
	if (lastMeasurementLine) {
		lastMeasurementLine.remove();
		lastMeasurementLine = null;
	}
	if (distancePointers) {
		distancePointers.forEach(dp => dp.remove());
		distancePointers = [];
	}
};
const measurePointToPoint = (map, useLatLng) => {
	let content;
	if (distancePointers.length === 2) {
		cleanupMeasurement();
	}
	distancePointers.push(L.circleMarker(useLatLng, {radius: 10}).addTo(map));

	if (distancePointers.length === 2) {
		let distance = useLatLng.distanceTo(distancePointers[0].getLatLng());
		let unit = 'meters';
		if (distance >= 10000) {
			distance /= 1000;
			unit = 'km';
		}
		content = `Distance: ${distance.toFixed(2)} ${unit}`;
		lastMeasurementLine = L.polyline(
			[distancePointers[0].getLatLng(), useLatLng],
			{color: 'red'}
		).addTo(map);
	} else {
		content = 'Select second point';
	}
	return content;
};
/** open LatLng popup on rightclick.
 * +shift => center of map / view
 * +alt => measure
 * +ctrl => copy latlng to clipboard
 */
const configContextMenu = map => {
	map.on('click', () => {
		cleanupMeasurement();
	});
	map.on('contextmenu', ({latlng, originalEvent}) => {
		originalEvent.preventDefault();
		let useLatLng = latlng;
		/** @type {string} */
		let content;

		if (originalEvent.shiftKey) {
			useLatLng = map.getCenter();
		}

		if (originalEvent.altKey) {
			content = measurePointToPoint(map, useLatLng);
		} else {
			content = `${useLatLng.lat.toFixed(4)}, ${useLatLng.lng.toFixed(4)}`;
		}

		// copy to clipboard handling
		if (originalEvent.ctrlKey && originalEvent.altKey) {
			// copy raw distance value
			navigator.clipboard.writeText(`${content.match(/\d+.\d+/)[0]}`);
		} else if (originalEvent.ctrlKey) {
			// copy latlng to clipboard as '[lat, lng]'
			navigator.clipboard.writeText(`[${content}],`);
		}
		if (content) {
			L.popup({content}).setLatLng(useLatLng).openOn(map);
		}
	});
};

/** add Earth images from OSM */
const topoURL = 'https://opentopomap.org/{z}/{x}/{y}.png';
const osmUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const addOSMTiles = (map, mapHUD) => {
	const layerOpts = {
		maxZoom: 10,
	};
	const mapTile = L.tileLayer(osmUrl, {
		...layerOpts,
		className: 'osm-tile',
		attribution:
			'&copy; <a href="http://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
	});
	mapTile.on('loaderror', console.warn);

	const topoTile = L.tileLayer(topoURL, {
		...layerOpts,
		className: 'topo-tile',
		attribution:
			'<a href="https://opentopomap.org">OpenTopoMap</a>, &copy; <a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>',
	});
	topoTile.on('loaderror', console.warn);

	// NB baseLayers[keys] are used for UI, unfortunately
	const baseLayers = {
		'Map Tile': mapTile,
		Topographic: topoTile,
	};
	const clonedLayers = {
		'osm-tile': cloneLayer(mapTile),
		'topo-tile': cloneLayer(topoTile),
	};
	mapTile.addTo(map);
	clonedLayers['osm-tile'].addTo(mapHUD);

	const layerControl = L.control.layers(baseLayers, {});
	layerControl.addTo(map);
	map.on('layerremove', ({layer}) => {
		if (clonedLayers[layer.options.className]) {
			clonedLayers[layer.options.className].remove();
		}
	});
	map.on('layeradd', ({layer}) => {
		if (clonedLayers[layer.options.className]) {
			clonedLayers[layer.options.className].addTo(mapHUD);
		}
	});
};

// /** add layers */
// const addLayerControl = map => {};

function bindCityLabelEvents() {
	// city labels show/hide
	document.querySelector('#show-city-labels').onclick = () => {
		document.dispatchEvent(eSHOW_CITY_LABELS);
	};
	document.querySelector('#hide-city-labels').onclick = () => {
		document.dispatchEvent(eHIDE_CITY_LABELS);
	};
}

function initMajorCities(map) {
	const toggleMajorCities = async () => {
		if (!simpleDataCache.majorCities) {
			simpleDataCache.majorCities = await genMajorCityMarkers();
		}
		const {majorCities} = simpleDataCache;
		if (map.hasLayer(majorCities)) {
			map.removeLayer(majorCities);
			console.log('remove major cities');
		} else {
			map.addLayer(majorCities);
			console.log('add major cities');
		}
	};
	document.querySelector('#highest-pop-cities').onclick = toggleMajorCities;
}

function initCountyHeatmap(map) {
	const toggleCountyHeatmap = async () => {
		if (!simpleDataCache.countyHeatmap) {
			simpleDataCache.countyHeatmap = await genCountyHeatmap();
		}
		const {countyHeatmap} = simpleDataCache;
		if (map.hasLayer(countyHeatmap)) {
			map.removeLayer(countyHeatmap);
			console.log('remove us county heatmap');
		} else {
			map.addLayer(countyHeatmap);
			console.log('add us county heatmap');
		}
	};
	document.querySelector('#county-heatmap').onclick = toggleCountyHeatmap;
}

/**
 * @param {string[]} states
 */
function setStateSelector(states) {
	const stateSelector = document.querySelector('#state-route-selector');
	stateSelector.innerHTML = '';

	states.forEach(name => {
		const option = document.createElement('option');
		option.value = name;
		option.textContent = name;
		stateSelector.appendChild(option);
	});
}
function initStateRoutes(map) {
	const stateSelector = document.querySelector('#state-route-selector');
	const countrySelector = document.querySelector('#country-route-selector');
	const stateSelectorEnter = document.querySelector('#state-route-show');

	// init values / html
	let selectedStateAbrv = 'PA';
	let selectedCountry = 'USA';
	setStateSelector(abbreviatedStateNames);
	stateSelector.value = selectedStateAbrv;

	countrySelector.addEventListener('change', e => {
		selectedCountry = e.target.value;
		switch (selectedCountry) {
			case 'USA':
				setStateSelector(abbreviatedStateNames);
				break;
		}
	});
	stateSelector.addEventListener('change', e => {
		selectedStateAbrv = e.target.value;
	});

	stateSelectorEnter.onclick = () => {
		const selectedStateName = abbreviatedStateToName[selectedStateAbrv];
		let stateZone;
		if (selectedCountry === 'USA') {
			if (['CT', 'PA', 'NY'].includes(selectedStateAbrv)) {
				stateZone = ZONE_NE.filter(route =>
					route.some(el => el.state === selectedStateName)
				);
			}
			console.log(stateZone);
		} else {
			alert(
				'todo: specific route for: ' + selectedCountry + ',' + selectedStateAbrv
			);
		}
		drawRegion(
			map,
			selectedStateName,
			coords[selectedCountry][selectedStateName]._CENTER,
			{zone: stateZone}
		);
	};
}

function initServiceWorker() {
	window.addEventListener('load', () => {
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker
				.register('/assets/js/service-worker/service-worker.js')
				.then(registration => {
					console.log(
						'Service Worker registered with scope:',
						registration.scope
					);
				})
				.catch(error => {
					console.error('Service Worker registration failed:', error);
				});
		} else {
			console.warn('Service Workers are not supported in this browser.');
		}
	});
}

function bindHomeIcon() {
	document.querySelector('#home-icon').onclick = () => {
		window.location.href = '/';
	};
}

function initSupportFunctions(map) {
	bindCityLabelEvents();
	bindHomeIcon();
	bindRegionButtonsToMap(map);
	initAddressLookup(map);
	initBoundaryButtons(map);
	initCountyHeatmap(map);
	initMajorCities(map);
	initPingCoord(map);
	initSoftRegions(map);
	initStateRoutes(map);
	initSupportDialog();
	// addLayerControl(map);
}

/**
 * main init function
 * @returns {[L.Map, L.Map]} map
 * */
export default function () {
	const [map, mapHUD] = initMaps();
	initMapHUDViewbox(map, mapHUD);
	addOSMTiles(map, mapHUD);
	configContextMenu(map);

	initSupportFunctions(map);

	// todo - caching
	// initServiceWorker();

	return [map, mapHUD];
}
