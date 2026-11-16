// Map / Satellite toggle, shown with the zoom and locate buttons (top-right).
// A plain MapLibre control (not React) so it sits in the same group styling as the others.

import type { IControl } from "maplibre-gl";

// Stacked layers, drawn in the current text color
const ICON =
  '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M10 3 2.5 7 10 11 17.5 7z"/><path d="m2.5 10.5 7.5 4 7.5-4"/><path d="m2.5 14 7.5 4 7.5-4"/></svg>';

export class BasemapControl implements IControl {
  private container: HTMLDivElement | null = null;
  private button: HTMLButtonElement | null = null;

  constructor(
    private onToggle: () => void,
    private satellite: boolean
  ) {}

  onAdd() {
    this.container = document.createElement("div");
    this.container.className = "maplibregl-ctrl maplibregl-ctrl-group";
    this.button = document.createElement("button");
    this.button.type = "button";
    this.button.className = "basemap-toggle";
    this.button.innerHTML = ICON;
    this.button.addEventListener("click", this.onToggle);
    this.container.appendChild(this.button);
    this.setSatellite(this.satellite);
    return this.container;
  }

  onRemove() {
    this.button?.removeEventListener("click", this.onToggle);
    this.container?.remove();
    this.container = this.button = null;
  }

  // Pressed (accent icon) while satellite is showing
  setSatellite(on: boolean) {
    this.satellite = on;
    if (!this.button) return;
    const label = on ? "Show map" : "Show satellite";
    this.button.setAttribute("aria-pressed", String(on));
    this.button.setAttribute("aria-label", label);
    this.button.title = label;
  }
}
