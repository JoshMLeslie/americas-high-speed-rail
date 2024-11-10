import { ZOOM_LEVEL } from './const/index.js';
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

	document
		.querySelector('#show-soft-regions')
		.addEventListener('change', (e) => {
			if (e.target.checked) {
				Object.keys(hasDrawn).forEach((elID) => {
					if (hasDrawn[elID].shown) {
						document.dispatchEvent(eSHOW_SOFT_REGION(elID));
					}
				});
			}
		});

	if (!hasDrawn[elID]) {
		const zoneData = drawZone(map, zone, COORDS);
		hasDrawn[elID] = {zoneData, shown: false};
	}

	const useCenter = typeof center === 'string' ? CENTERS[center] : center;
	const isCentered = map.getCenter().equals(useCenter, 2);
	const flyTo = () => map.flyTo(useCenter, zoom, {duration: 0.5});
	if (hasDrawn[elID].shown && isCentered) {
		map.removeLayer(hasDrawn[elID].zoneData);
		document.dispatchEvent(eHIDE_SOFT_REGION(elID));
		hasDrawn[elID].shown = false;
	} else if (hasDrawn[elID].shown && !isCentered) {
		flyTo();
	} else {
		map.addLayer(hasDrawn[elID].zoneData);
		if (showSoftRegion) {
			document.dispatchEvent(eSHOW_SOFT_REGION(elID));
		}
		flyTo();
		hasDrawn[elID].shown = true;
	}
};
