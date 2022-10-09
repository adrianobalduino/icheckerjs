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

// Set up the button logic
inputRequirements.onchange = () => loadJson();
inputIfc.onchange = () => loadIfc();

loadIfcButton.onclick = () => inputIfc.click();
loadRequirements.onclick = () => inputRequirements.click();
checkIfc.onclick = () => checkModel();

async function loadJson(){
  //Load the Requirements
  const requirements = inputRequirements.files[0];
  const urlRequirements = URL.createObjectURL(requirements);

  const rawRequirements = await fetch(urlRequirements);
  reqPar = await rawRequirements.json();
}

async function loadIfc() {
		// Load thpropprope model
    const file = inputIfc.files[0];
    const url = URL.createObjectURL(file);
    model = await viewer.IFC.loadIfcUrl(url);

		// Add dropped shadow and post-processing efect
    await viewer.shadowDropper.renderShadow(model.modelID);   
}

async function checkModel(){

  scene = viewer.context.getScene();

  //Serialize properties
  const result = await viewer.IFC.properties.serializeAllProperties(model);
  const fileResults = new File(result, 'properties');
  const urlResults = URL.createObjectURL(fileResults);
  const rawProperties = await fetch(urlResults);
  const prop = await rawProperties.json();
  const fail = [];
  let ifc_entity;
  let property_set;
  let property_value;
  let flag_propriedade = 0;

  const filteredParameters = reqPar.filter(item => item.PropertySet != 'Identification');

  for(value in filteredParameters){
    ifc_entity = filteredParameters[value].IFCEntity;
    property_set = filteredParameters[value].PropertySet;
    property_value = filteredParameters[value].Property;

    for (var key in prop) {
      if ((prop[key].type) == ifc_entity) {
          //console.log(prop[key].expressID);
          const propertyValues = Object.values(prop);
          const allPsetsRels = propertyValues.filter(item => item.type === 'IFCRELDEFINESBYPROPERTIES');
          const relatedPsetsRels = allPsetsRels.filter(item => item.RelatedObjects.includes(prop[key].expressID));
          const psets = relatedPsetsRels.map(item => prop[item.RelatingPropertyDefinition]);
          for (let pset of psets) {
              for (parameter in pset.HasProperties) {
                  let propriedade = propertyValues.filter(item => item.expressID === pset.HasProperties[parameter]);
                  for (let pr of propriedade) {
                      if (property_set == decodeIFCString(pset.Name) && property_value == decodeIFCString(pr.Name)) {
                          flag_propriedade = 1
                      }
                  }
              }
              for (parameter in pset.Quantities) {
                  let propriedade = propertyValues.filter(item => item.expressID == pset.Quantities[parameter]);
                  for (let pr of propriedade) {
                      if (property_set == decodeIFCString(pset.Name) && property_value == decodeIFCString(pr.Name)) {
                          flag_propriedade = 1
                      }
                  }
              }
          }
          if (flag_propriedade == 0) {
              fail.push(prop[key].expressID);
          } else if (flag_propriedade == 1) {                
              flag_propriedade = 0;
          }
      }
    }
  }
  let fail_set = [...new Set(fail)];
  console.log(fail_set);

  model.removeFromParent();
  const subset = await newSubsetOfType(fail_set);
  scene.add(subset);
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