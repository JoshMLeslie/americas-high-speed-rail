'use strict';

import init from './assets/js/init.js';

const [map, mapHUD] = init();

const resizeDiv = document.querySelector('#resize-divider');
const mapCont = document.querySelector('#map-container');
const hudMapCont = document.querySelector('#hud-map-container');

resizeDiv.ondrag = ({offsetX}) => {
	// defend against last drag event having an errant offset
	if (Math.abs(offsetX) > 50) return;
	// defend against compressing the divs too small
	if (
		(hudMapCont.clientWidth < 220 && offsetX > 0) ||
		(mapCont.clientWidth < 220 && offsetX < 0)
	)
		return;

	const max = document.body.clientWidth;
	const maxDiff = max - mapCont.clientWidth - hudMapCont.clientWidth;
	const halfMaxDiff = maxDiff / 2;
	mapCont.style.width = mapCont.clientWidth + halfMaxDiff + offsetX + 'px';
	hudMapCont.style.width =
		hudMapCont.clientWidth + halfMaxDiff - offsetX + 'px';
};
resizeDiv.ondragend = () => {
	setTimeout(() => {
		map.invalidateSize();
		mapHUD.invalidateSize();
	});
};
