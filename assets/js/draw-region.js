import { HIDE_SOFT_REGION, SHOW_SOFT_REGION, ZOOM_LEVEL } from './const/index.js';
import COORDS from './coords.js';
import { eHIDE_SOFT_REGION, eSHOW_SOFT_REGION } from './events.js';
import { drawZone } from './mapping/draw.js';
import CENTERS from './zones/centers.js';

/**
 * @type {{
 * 	[center: string]: {zoneData: any; shown: boolean}
 * }}
 */
const hasDrawn = {};
const softRegionDispatchers = {};

const softRegionDispatcher = (elID) => (e) => {
	if (e.target.checked) {
		document.dispatchEvent(eSHOW_SOFT_REGION(elID));
	} else {
		document.dispatchEvent(eHIDE_SOFT_REGION(elID));
	}
};

const addSoftRegionCheckboxListener = (elID) => {
	if (!softRegionDispatchers[elID]) {
		softRegionDispatchers[elID] = softRegionDispatcher(elID);
	}
	document
		.querySelector('#show-soft-regions')
		.addEventListener('change', softRegionDispatchers[elID]);
};

const removeSoftRegionCheckboxListener = (elID) => {
	document
		.querySelector('#show-soft-regions')
		.removeEventListener('change', softRegionDispatchers[elID]);
};

export const initSoftRegionActors = (map) => {
	document.addEventListener(SHOW_SOFT_REGION, ({detail}) => {
		const softRegion = hasDrawn[detail].zoneOutline;
		if (softRegion) {
			map.addLayer(softRegion);
		} else {
			throw ReferenceError(`soft region DNE for '${detail}'`);
		}
	});
	document.addEventListener(HIDE_SOFT_REGION, ({detail}) => {
		const softRegion = hasDrawn[detail].zoneOutline;
		if (map.hasLayer(softRegion)) {
			if (softRegion) {
				map.removeLayer(softRegion);
			} else {
				throw ReferenceError(`soft region DNE for '${detail}'`);
			}
		}
	});
};

/**
 * @param {keyof CENTERS} center
 * @param {{zone: Zone, zoom: number}}
 */
export const drawRegion = (
	map,
	elID,
	center,
	{zone, zoom = ZOOM_LEVEL.country} = {}
) => {
	if (!elID || !center || !zone) {
		throw ReferenceError('missing required argument(s)');
	}

	const showSoftRegion = document.querySelector('#show-soft-regions').checked;

	if (!hasDrawn[elID]) {
		const [zoneData, zoneOutline] = drawZone(map, zone, COORDS);
		hasDrawn[elID] = {zoneData, zoneOutline, shown: false};
	}
	const useCenter = typeof center === 'string' ? CENTERS[center] : center;
	const isCentered = map.getCenter().equals(useCenter, 2);
	const flyTo = () => map.flyTo(useCenter, zoom, {duration: 0.5});

	if (hasDrawn[elID].shown) {
		if (isCentered) {
			map.removeLayer(hasDrawn[elID].zoneData);
			if (map.hasLayer(hasDrawn[elID].zoneOutline)) {
				map.removeLayer(hasDrawn[elID].zoneOutline);
			}
			hasDrawn[elID].shown = false;
			removeSoftRegionCheckboxListener(elID);
		} else {
			flyTo();
		}
	} else {
		addSoftRegionCheckboxListener(elID);
		map.addLayer(hasDrawn[elID].zoneData);
		if (showSoftRegion) {
			map.addLayer(hasDrawn[elID].zoneOutline);
		}
		flyTo();
		hasDrawn[elID].shown = true;
	}
};
