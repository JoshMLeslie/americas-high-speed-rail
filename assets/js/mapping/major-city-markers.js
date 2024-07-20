
/* global L:readonly */

import { fetchJSON } from "../util.js";
import { drawMarker } from "./draw.js";

const showCityMarkerPos = (map, lat, lon, city) => e => {
	const {lat: layerLat, lng: layerLon} = map.layerPointToLatLng(
		L.point(e.layerPoint)
	);

	// sanity check on layer conversion
	const useLat =
		layerLat.toFixed(1) == lat.toFixed(1) ? layerLat.toFixed(4) : lat;
	const useLon =
		layerLon.toFixed(1) == lon.toFixed(1) ? layerLon.toFixed(4) : lon;

	const txt = `'${city}': [${[useLat, useLon]}],`;
	console.log(txt);
	navigator.clipboard.writeText(txt);
};

export default async function genMajorCityMarkers (map) {
	/** @type {{lat: number; lon: number; city: string;}[]}} data */
	const data = await fetchJSON('./data-csv/parsed_results.json');
	if (!data || !data.length) {
		throw ReferenceError("missing CSV data");
	}
	const markers = data.map(({lat, lon, city}) => {
		const m = drawMarker(map, [lat, lon], city, {color: 'red'});
		m.on('click', showCityMarkerPos(map, lat, lon, city));
		return m;
	});
	return L.markerClusterGroup(markers, {
		maxClusterRadius: 40,
	});
};