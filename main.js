import COORDS from "./coords.js";
import NE_STATES from "./states/north-east.js";
import BW_NE from "./states/between.js";

const USA_CENTER = [39.833, -98.583];
const NE_CENTER = [40.261354, -74.518535];

// INIT
// var map = L.map('map').setView(USA_CENTER, 4);
var map = L.map('map').setView(NE_CENTER, 6);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 10,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);
// INIT END

const draw = (args, opts = {}) => {
    L.polyline(args, opts).addTo(map);
}

const drawState = (state, coords) => {
    const { cities, routes, phases } = state;
    for (const route of routes) {
        if (!route) {
            console.error('state', state)
            throw ReferenceError("malformed data ")
        }
        const routeCoords = route.map(r => coords[r])
        draw(routeCoords)
    }
}

const drawStates = (states, coords) => {
    for (const state in states) {
        drawState(states[state], coords[state]);
    }
}

const drawBetween = (routeData, coords) => {
    const { from, to } = routeData;
    const fromCoords = coords[from.state][from.city]
    const toCoords = coords[to.state][to.city]
    if (!fromCoords) {
        console.error('bad from coord', routeData)
    }
    if (!toCoords) {
        console.error('bad to coord', routeData)
    }
    draw([fromCoords, toCoords], {
        color: 'green',
    });
}

const drawAllBetween = (routes, coords) => {
    routes.forEach(route => drawBetween(route, coords));
}

// btn binding
document.querySelector('#usa-region-btn').onclick = () => {
    map.setView(USA_CENTER, 4);
}
document.querySelector('#north-east-region-btn').onclick = () => {
    map.setView(NE_CENTER, 6);
    drawStates(NE_STATES, COORDS);
    drawAllBetween(BW_NE, COORDS);
}