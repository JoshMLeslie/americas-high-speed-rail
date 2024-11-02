'use strict';
/* global L:readonly */

import NominatimJS from '../mapping/nominatim.js';
import pingMarker from '../mapping/ping-marker.js';

export default function initAddressLookup(map) {
	let nominatim;
	const nominatimMarker = async (search, results) => {
		if (!search && !results) return;
		let clearVal;
		console.log(results);
		try {
			results ||= await nominatim.search({q: search});
			if (results) {
				clearVal = true;
			}
			if (results.length) {
				const markers = results.map(r =>
					pingMarker(map, r, {isJSON: true, flyTo: false})
				);
				const bounds = L.featureGroup(markers).getBounds().pad(0.5);
				map.fitBounds(bounds);
			} else {
				alert('no results');
				return;
			}
		} catch (e) {
			console.warn(e);
			alert(e);
		}
		return clearVal;
	};

	const locationInput = document.querySelector('#lookup-location');
	locationInput.addEventListener('keydown', async e => {
		if (!nominatim) {
			nominatim = new NominatimJS();
		}
		if (e.code === 'Enter') {
			if (await nominatimMarker(e.target.value)) {
				e.target.value = '';
			}
		}
	});
	document.querySelector('#lookup-location-enter').onclick = async () => {
		if (await nominatimMarker(locationInput.value)) {
			locationInput.value = '';
		}
	};
	document.querySelector('#lookup-location-clear').onclick = () => {
		locationInput.value = '';
	};
	const popupContainer = document.querySelector('#popup-container');
	document.querySelector('#lookup-location-list').onclick = async () => {
		try {
			const query = locationInput.value;
			locationInput.value = 'Loading';
			const results = await nominatim.search({q: query});
			if (results) {
				popupContainer.classList.toggle('hidden');
				locationInput.value = 'Select an option';
				const list = document.createElement('ul');
				list.id = 'lookup-location-list-popup';
				results.forEach(r => {
					const li = document.createElement('li');
					const btn = document.createElement('button');
					btn.textContent = r.display_name;
					btn.onclick = () => {
						console.log(r);
						nominatimMarker(null, [r]);
						locationInput.value = '';
						popupContainer.innerHTML = '';
						popupContainer.classList.toggle('hidden');
					};
					li.appendChild(btn);
					list.appendChild(li);
				});
				popupContainer.appendChild(list);
			}
		} catch (e) {
			console.warn(e);
			alert(e);
		}
	};
}
