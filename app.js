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
        viewer.IFC.selector.unHighlightIfcItems();
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
        //window.ondblclick = () => viewer.IFC.selector.pickIfcItem();
        window.onmousemove = () => viewer.IFC.selector.prePickIfcItem();

        window.ondblclick = async () => {
            const result = await viewer.IFC.selector.highlightIfcItem();
            if (!result) return;
            const { modelID, id } = result;
            const props = await viewer.IFC.getProperties(modelID, id, true, false);
            createPropertiesMenu(props);
        };
        },
    false
);


const propsGUI = document.getElementById("ifc-property-menu-root");

function createPropertiesMenu(properties) {
    console.log(properties);

    removeAllChildren(propsGUI);

    delete properties.psets;
    delete properties.mats;
    delete properties.type;

    for (let key in properties) {
        createPropertyEntry(key, properties[key]);
    }

}



function createPropertyEntry(key, value) {
    const propContainer = document.createElement("div");
    propContainer.classList.add("ifc-property-item");

    if(value === null || value === undefined) value = "undefined";
    else if(value.value) value = value.value;

    const keyElement = document.createElement("div");
    keyElement.textContent = key;
    propContainer.appendChild(keyElement);

    const valueElement = document.createElement("div");
    valueElement.classList.add("ifc-property-value");
    valueElement.textContent = value;
    propContainer.appendChild(valueElement);

    propsGUI.appendChild(propContainer);
}

function removeAllChildren(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}