import {
	HIDE_CITY_LABELS,
	HIDE_SOFT_REGION,
	SHOW_CITY_LABELS,
	SHOW_SOFT_REGION,
} from './const/index.js';

export const eSHOW_CITY_LABELS = new Event(SHOW_CITY_LABELS);
export const eHIDE_CITY_LABELS = new Event(HIDE_CITY_LABELS);

export const eSHOW_SOFT_REGION = (detail) =>
	new CustomEvent(SHOW_SOFT_REGION, {detail});
export const eHIDE_SOFT_REGION = (detail) =>
	new CustomEvent(HIDE_SOFT_REGION, {detail});
