import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

const container = document.getElementById('viewer-container');
const viewer = new IfcViewerAPI({ container, backgroundColor: new Color(0xffffff) });

// Create grid and axes
viewer.grid.setGrid();
viewer.axes.setAxes();

// Get all buttons
const loadIfcButton = document.getElementById('load-ifc');
const loadRequirements = document.getElementById('load-json');
const checkIfc = document.getElementById('check');

const inputIfc = document.getElementById('file-input-ifc');
const inputRequirements = document.getElementById('file-input-json');

let model;
let reqPar;
let scene;
const fail = [];
const fail_property = [];
let missingProp = [];

const pickable = viewer.context.items.pickableIfcModels;
const index = pickable.indexOf(model);

const propsGUI = document.getElementById("ifc-property-menu-root");

// Set up the button logic
inputRequirements.onchange = () => loadJson();
inputIfc.onchange = () => loadIfc();

loadIfcButton.onclick = () => inputIfc.click();
loadRequirements.onclick = () => inputRequirements.click();
checkIfc.onclick = () => checkModel();

async function loadJson(){
  loadingStart();
  //Load the Requirements
  const requirements = inputRequirements.files[0];
  const urlRequirements = URL.createObjectURL(requirements);

  const rawRequirements = await fetch(urlRequirements);
  reqPar = await rawRequirements.json();
  loadingEnd();
  document.getElementById("save-success-message").classList.remove("invisible");
  setTimeout(function(){
    document.getElementById("save-success-message").classList.add("invisible")},2000);
}


async function loadIfc() {

  loadingStart();
  // Load thpropprope model
  const file = inputIfc.files[0];
  const url = URL.createObjectURL(file);
  model = await viewer.IFC.loadIfcUrl(url);

  // Add dropped shadow and post-processing efect
  await viewer.shadowDropper.renderShadow(model.modelID);   
  window.onmousemove = async () => await viewer.IFC.selector.prePickIfcItem();

  loadingEnd();
  document.getElementById("save-success-message").classList.remove("invisible");
  setTimeout(function(){
    document.getElementById("save-success-message").classList.add("invisible")},2000);

  window.ondblclick = async () => {
    const result = await viewer.IFC.selector.pickIfcItem();
    if (!result) return;
    const { modelID, id } = result;
    const props = await viewer.IFC.getProperties(modelID, id, true, false);
    createPropertiesMenu(props);
  };
}


async function checkModel(){

  loadingStart();

  scene = viewer.context.getScene();

  //Serialize properties
  const result = await viewer.IFC.properties.serializeAllProperties(model);
  const fileResults = new File(result, 'properties');
  const urlResults = URL.createObjectURL(fileResults);
  const rawProperties = await fetch(urlResults);
  const prop = await rawProperties.json();

  let ifc_entity;
  let property_set;
  let property_value;
  let flag_propriedade = 0;

  const filteredParameters = reqPar.filter(item => item.PropertySet != 'Identification');
  const propertyValues = Object.values(prop);
  const allPsetsRels = propertyValues.filter(item => item.type === 'IFCRELDEFINESBYPROPERTIES');

  for(value in filteredParameters){
    ifc_entity = filteredParameters[value].IFCEntity;
    property_set = filteredParameters[value].PropertySet;
    property_value = filteredParameters[value].Property;

    for (var key in prop) {
      if ((prop[key].type) == ifc_entity) {
        const relatedPsetsRels = allPsetsRels.filter(item => item.RelatedObjects.includes(prop[key].expressID));
        const psets = relatedPsetsRels.map(item => prop[item.RelatingPropertyDefinition]);
        outer_loop:
          for (let pset of psets) {
            if(decodeIFCString(pset.Name == property_set)){
              for (parameter in pset.HasProperties) {
                let propriedade = propertyValues.filter(item => item.expressID === pset.HasProperties[parameter]);
                for (let pr of propriedade) {
                  if (property_set == decodeIFCString(pset.Name) && property_value == decodeIFCString(pr.Name)) {
                    flag_propriedade = 1;
                    break outer_loop;
                  }
                }
              }
              for (parameter in pset.Quantities) {
                let propriedade = propertyValues.filter(item => item.expressID == pset.Quantities[parameter]);
                for (let pr of propriedade) {
                  if (property_set == decodeIFCString(pset.Name) && property_value == decodeIFCString(pr.Name)) {
                    flag_propriedade = 1;
                    break outer_loop;
                  }
                }
              }
            }
          }
        if (flag_propriedade == 0) {
          fail.push(prop[key].expressID);
          fail_property.push(property_set + "." + property_value);
        } else if (flag_propriedade == 1) {                
          flag_propriedade = 0;
        }
      }
    }
  }
  let fail_set = [...new Set(fail)];
  // console.log(fail);
  // console.log(fail_property);

  model.removeFromParent();
  pickable.splice(index, 1);
  const subset = await newSubsetOfType(fail_set);
  scene.add(subset);
  pickable.push(subset);

  loadingEnd();
  document.getElementById("save-success-message").classList.remove("invisible");
  setTimeout(function(){
    document.getElementById("save-success-message").classList.add("invisible")},2000);

}

function decodeIFCString(ifcString) {
  const ifcUnicodeRegEx = /\\X2\\(.*?)\\X0\\/uig;
  let propString = ifcString;
  let match = ifcUnicodeRegEx.exec(ifcString);
  while (match) {
      const unicodeChar = String.fromCharCode(parseInt(match[1], 16));
      propString = propString.replace(match[0], unicodeChar);
      match = ifcUnicodeRegEx.exec(ifcString);
  }
  return propString;
}

async function newSubsetOfType(list_ids){
  const ids = list_ids;
  return viewer.IFC.loader.ifcManager.createSubset({
    modelID: 0,
    scene,
    ids,
    removePrevious: true,
  });
}

function loadingStart(){
  document.getElementById("loading").classList.remove("invisible");
}

function loadingEnd(){
  document.getElementById("loading").classList.add("invisible");
}

function createPropertiesMenu(properties) {
  //console.log(properties);

  removeAllChildren(propsGUI);

  delete properties.psets;
  delete properties.mats;
  delete properties.type;

  for (let key in properties) {
    if(key == 'expressID' || key == 'GlobalId' || key == 'Name' || key == 'Description'){
      createPropertyEntry(key, decodeIFCString(properties[key]));
    }
  }
  createPropertyEntry("Missing Properties", missingProperties(properties.expressID));
}

function missingProperties(expressID){
  missingProp = [];
  for (var i = 0; i < fail.length ; i++){
    if(fail[i] == expressID){
      missingProp.push(fail_property[i]);
    }
  }
  if(missingProp){
    return missingProp;
  } else {
    return;
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
