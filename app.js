import { Color, Scene } from "three";
import { IfcViewerAPI } from "web-ifc-viewer";

const container = document.getElementById('viewer-container');
const viewer = new IfcViewerAPI({container, backgroundColor: new Color(0xffffff)});

viewer.axes.setAxes();
viewer.grid.setGrid();

const input = document.getElementById("file-input");

input.addEventListener(
    "change",
    async (changed) => {
        const ifcURL = URL.createObjectURL(changed.target.files[0]);
        const model = await viewer.IFC.loadIfcUrl(ifcURL);
        await viewer.shadowDropper.renderShadow(model.modelID);
        },
    false
);


