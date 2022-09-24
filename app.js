import { Color, Scene } from "three";
import { IfcViewerAPI } from "web-ifc-viewer";

const container = document.getElementById('viewer-container');
const viewer = new IfcViewerAPI({container, backgroundColor: new Color(0xffffff)});
viewer.grid.setGrid();
viewer.axes.setAxes();

const input = document.getElementById("file-input");
const selection = document.getElementById("btn-selection");
const dimension = document.getElementById("btn-dimension");

selection.addEventListener(
    "click",
    async (clicked) => {
        viewer.dimensions.active= false;
        viewer.dimensions.previewActive = false;
        dimension.className="btn btn-light";
        selection.className="btn btn-dark";
        window.ondblclick = () => viewer.IFC.selector.pickIfcItem();
        window.onmousemove = () => viewer.IFC.selector.prePickIfcItem();
    },
    )

dimension.addEventListener(
    "click", 
    async (clicked) => {
        selection.className="btn btn-light";
        dimension.className="btn btn-dark";
        viewer.dimensions.active= true;
        viewer.dimensions.previewActive = true;

        window.ondblclick = () => {
            viewer.dimensions.create();
        }

        window.onkeydown = (event) => {
            if(event.code === 'Delete'){
                viewer.dimensions.delete();
            }
        }
}, false
 );

input.addEventListener(
    "change",
    async (changed) => {
        const ifcURL = URL.createObjectURL(changed.target.files[0]);
        const model = await viewer.IFC.loadIfcUrl(ifcURL);
        await viewer.shadowDropper.renderShadow(model.modelID);
        window.ondblclick = () => viewer.IFC.selector.pickIfcItem();
        window.onmousemove = () => viewer.IFC.selector.prePickIfcItem();
        },
    false
);

    

