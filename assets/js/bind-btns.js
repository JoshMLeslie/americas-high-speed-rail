'use strict';
import { ZOOM_LEVEL } from './const/index.js';
import { drawRegion } from './draw-region.js';
import ZONE_CENTRAL from './zones/central.js';
import ZONE_G_LAKES from './zones/great-lakes.js';
import ZONE_INTERCONTINENTAL from './zones/intercontinental.js';
import ZONE_NE from './zones/north-east.js';
import ZONE_SE from './zones/south-east.js';
import ZONE_WEST from './zones/west.js';

export const bindRegionButtonsToMap = (map) => {
	/**
	 * @param {string} elID - raw id, no '#' etc. e.g. `<div id="west"></div>` => 'west'
	 * @param {any[]} args - @see drawRegion
	 */
	const bindRegionBtn = (elID, ...args) => {
		document.querySelector('.region-btn#' + elID).onclick = () => {
			drawRegion(map, elID, ...args);
		};
	};

	bindRegionBtn('intercontinental', 'AMERICAS', {
		zone: ZONE_INTERCONTINENTAL,
		zoom: ZOOM_LEVEL.continent,
	});
	bindRegionBtn('namr', 'NA', {zoom: ZOOM_LEVEL.continent});
	bindRegionBtn('usa', 'USA');
	bindRegionBtn('canada', 'CANADA');
	bindRegionBtn('mexico', 'MEXICO');
	bindRegionBtn('west', 'NA_WEST', {zone: ZONE_WEST, zoom: ZOOM_LEVEL.region});
	bindRegionBtn('central', 'NA_CENTRAL', {
		zone: ZONE_CENTRAL,
		zoom: ZOOM_LEVEL.region,
	});
	bindRegionBtn('great-lakes', 'NA_G_LAKES', {
		zone: ZONE_G_LAKES,
		zoom: ZOOM_LEVEL.tristate,
	});
	bindRegionBtn('north-east', 'NA_NE', {
		zone: ZONE_NE,
		zoom: ZOOM_LEVEL.tristate,
	});
	bindRegionBtn('south-east', 'NA_SE', {
		zone: ZONE_SE,
		zoom: ZOOM_LEVEL.tristate,
	});
};

// handles caching to preserve leaflet layer ids
const countryBoundaryData = {
	Canada: {
		showing: [],
		data: [],
	},
	USA: {
		showing: [],
		data: [],
	},
	Mexico: {
		showing: [],
		data: [],
	},
};
/**
 * @param {number} mapZoom
 * @returns {number}
 */
function zoomToLayer(mapZoom) {
	const maxResolution = Number(
		document.querySelector('#max-boundary-resolution').value
	);
	let layer = 2;
	if (mapZoom <= 3) {
		layer = 0;
	} else if (mapZoom === 4 || mapZoom === 5) {
		layer = 1;
	}
	return layer > maxResolution ? maxResolution : layer;
}
/**
 *
 * @param {L.Map} map
 * @param {(layer: number) => Promise<L.GeoJSON>} getter
 * @param {string} country
 */
async function handleCountryBoundary(map, getter, country) {
	const layer = zoomToLayer(map.getZoom());
	if (countryBoundaryData[country].showing[layer]) {
		// if the current layer is the activated layer and is showing, toggle it off
		countryBoundaryData[country].showing[layer] = false;
		countryBoundaryData[country].data[layer].removeFrom(map);
	} else {
		// else the desired layer is not showing, reset all country's layers
		for (let i = 0; i < 3; i++) {
			countryBoundaryData[country].showing[i] = false;
			countryBoundaryData[country].data[i]?.removeFrom(map);
		}
		// if data exists, use it, else fetch it
		const dataLayer = countryBoundaryData[country].data[layer];
		if (dataLayer) {
			dataLayer.addTo(map);
		} else {
			countryBoundaryData[country].data[layer] = (await getter(layer)).addTo(
				map
			);
		}
		countryBoundaryData[country].showing[layer] = true;
	}
}
/**
 * @param {string} buttonID
 * @see handleCountryBoundary for additional args
 */
function bindBtnCountryBoundary(buttonID, ...args) {
	document.querySelector('#' + buttonID).onclick = async () => {
		handleCountryBoundary(...args);
	};
}

function handleBoundaryZoomChange(map, boundaryData) {
	const newLayer = zoomToLayer(map.getZoom());

	Object.keys(countryBoundaryData).forEach((country) => {
		const activeLayer = countryBoundaryData[country].showing.findIndex(Boolean);
		if (activeLayer > -1 && activeLayer !== newLayer) {
			const getterLabel = 'get' + country;
			handleCountryBoundary(map, boundaryData[getterLabel], country);
		}
	});
}

// Called by init.js to pass down map and boundaryData
// When adding a new country, be sure to add its getter in boundaryData
// as well as a key in the countryBoundaryData cache
export const setupBoundaryButtons = (map, boundaryData) => {
	map.on('zoomend', (e) => {
		handleBoundaryZoomChange(e.sourceTarget, boundaryData);
	});

	document
		.querySelector('#max-boundary-resolution')
		.addEventListener('change', () => {
			handleBoundaryZoomChange(map, boundaryData);
		});

	bindBtnCountryBoundary(
		'highlight-boundary-canada',
		map,
		boundaryData.getCanada,
		'Canada'
	);
	bindBtnCountryBoundary(
		'highlight-boundary-usa',
		map,
		boundaryData.getUSA,
		'USA'
	);
	bindBtnCountryBoundary(
		'highlight-boundary-mexico',
		map,
		boundaryData.getMexico,
		'Mexico'
	);
};
