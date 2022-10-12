import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

const container = document.getElementById('viewer-container');
let viewer = new IfcViewerAPI({ container, backgroundColor: new Color(0xffffff) });

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
  const table = document.getElementById('info-table');

  model = await viewer.IFC.loadIfcUrl(url);

  // Add dropped shadow and post-processing efect
  await viewer.shadowDropper.renderShadow(model.modelID);   
  window.onmousemove = async () => await viewer.IFC.selector.prePickIfcItem();
  viewer.clipper.active = true;

  loadingEnd();
  document.getElementById("save-success-message").classList.remove("invisible");
  setTimeout(function(){
    document.getElementById("save-success-message").classList.add("invisible")},2000);

  window.ondblclick = async () => {
    const result = await viewer.IFC.selector.pickIfcItem();
    if (!result) return;
    const { modelID, id } = result;
    const props = await viewer.IFC.getProperties(modelID, id, true, false);
    addPropertyEntry(table, props)
  };
}

window.onkeydown = (event) => {
  if (event.code === "KeyP") {
    viewer.clipper.createPlane();
  } else if (event.code === "KeyO") {
    viewer.clipper.deletePlane();
  }
};

async function checkModel(){

  viewer.IFC.selector.unpickIfcItems();
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
  let all_ifc_classes = [];
  let flag_propriedade = 0;

  const filteredParameters = reqPar.filter(item => item.PropertySet != 'Identification');
  const propertyValues = Object.values(prop);
  const allPsetsRels = propertyValues.filter(item => item.type === 'IFCRELDEFINESBYPROPERTIES');

  for (value in filteredParameters){
    property_value = filteredParameters[value].IFCEntity;
    all_ifc_classes.push(property_value);
  }
  const set_ifc_classes = [...new Set(all_ifc_classes)];

  const filteredValues = propertyValues.filter(item => set_ifc_classes.includes(item.type));

  for(var key in filteredValues){
    for(value in filteredParameters){
      ifc_entity = filteredParameters[value].IFCEntity;
      property_set = filteredParameters[value].PropertySet;
      property_value = filteredParameters[value].Property;
      if(filteredValues[key].type == ifc_entity){
        const relatedPsetsRels = allPsetsRels.filter(item => item.RelatedObjects.includes(filteredValues[key].expressID));
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
          fail.push(filteredValues[key].expressID);
          fail_property.push(property_set + "." + property_value);
          } else if (flag_propriedade == 1) {                
          flag_propriedade = 0;
          }
        }
        }
    }
  let fail_set = [...new Set(fail)]

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

function addPropertyEntry(table, properties){

  const body = table.querySelector('tbody');
  while (body.firstChild){
    body.removeChild(body.firstChild);
  }

  delete properties.psets;
  delete properties.mats;
  delete properties.type;
  
  for(let key in properties){
    if (key == 'expressID' || key == 'GlobalId' || key == 'Name' || key == 'Description'){
      let row = document.createElement('tr');
      body.appendChild(row);
      const propertyName = document.createElement('td');
      propertyName.textContent = key;
      row.appendChild(propertyName);

      let value;

      if(decodeIFCString(properties[key] == null || decodeIFCString(properties[key]) === undefined)){
        value = "Unknown";
      } else if(decodeIFCString(properties[key]) && key == 'expressID') {
        value = decodeIFCString(properties[key]);
      } else {
        value = decodeIFCString(properties[key]).value;
      }
      let propertyValue = document.createElement('td');
      propertyValue.textContent = value;
      row.appendChild(propertyValue);
    }
  }

  row = document.createElement('tr');
  body.appendChild(row);
  propertyName = document.createElement('td');
  propertyName.textContent = 'Missing Properties';
  row.appendChild(propertyName);

  propertyValue = document.createElement('td');
  propertyValue.textContent = missingProperties(properties.expressID);
  row.appendChild(propertyValue);
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
