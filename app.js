import { Color } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';
import { IFCSPACE } from 'web-ifc';

const container = document.getElementById('viewer-container');
let viewer = new IfcViewerAPI({ container, backgroundColor: new Color(0xffffff) });

// Create grid and axes
viewer.grid.setGrid();
viewer.axes.setAxes();

// Get all buttons
const loadIfcButton = document.getElementById('load-ifc');
const loadRequirements = document.getElementById('load-json');
const checkIfc = document.getElementById('check');
const measure = document.getElementById('measure');
const table = document.getElementById('info-table');
const selection = document.getElementById('selection');
const ulSelector = document.getElementById('ulItem');

const inputIfc = document.getElementById('file-input-ifc');
const inputRequirements = document.getElementById('file-input-json');
let checked = false;

let result;
let model;
let reqPar;
let scene;
let subset;
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
measure.onclick = () => measureModel();
selection.onclick = () => selectionMode();

async function clickEventHandler(e){
  if(e.target.matches(".nav-link")){
    loadTable(e.target.dataset.elementId);
  }

  let navLinks = document.querySelectorAll(".nav-link");

  navLinks.forEach(function(linkEl){
    linkEl.classList.remove("active");
  });

  e.target.classList.add("active");
}

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
  viewer.clipper.active = true;

  loadingEnd();
  document.getElementById("save-success-message").classList.remove("invisible");
  setTimeout(function(){
    document.getElementById("save-success-message").classList.add("invisible")},2000);

  selectionMode();
  scene = viewer.context.getScene();
}

async function clearSelection(){
  viewer.IFC.selector.unpickIfcItems();
}

async function selectionMode(){

  clearSelection();
  viewer.dimensions.active = false;
  viewer.dimensions.previewActive = false;

  window.onmousemove = async () => await viewer.IFC.selector.prePickIfcItem();

  window.ondblclick = async () => {
    result = await viewer.IFC.selector.pickIfcItem();
    if (!result) return;
    const { modelID, id } = result;
    const props = await viewer.IFC.getProperties(modelID, id, true, false);
    const propertySets = await viewer.IFC.loader.ifcManager.getPropertySets(modelID, id);

    for(const propertySet of propertySets){
      const realValues = [];

      if(propertySet.HasProperties){
        for(const propriedade of propertySet.HasProperties){
          const id = propriedade.value;
          const value = await viewer.IFC.loader.ifcManager.getItemProperties(modelID, id);
          realValues.push(value);
        }
        propertySet.HasProperties = realValues;
      }

      if(propertySet.Quantities){
        for(const propriedade of propertySet.Quantities){
          const id = propriedade.value;
          const value = await viewer.IFC.loader.ifcManager.getItemProperties(modelID, id);
          realValues.push(value);
          }

        propertySet.Quantities = realValues;
      }
    }

    while (ulSelector.firstChild){
      ulSelector.removeChild(ulSelector.firstChild);
    }

    let ulItem = document.createElement('li');
    ulItem.classList.add("nav-item");
    ulSelector.appendChild(ulItem);

    let propertySetName = document.createElement('div');
    propertySetName.classList.add("nav-link");
    propertySetName.classList.add("active");
    propertySetName.textContent = decodeIFCString('Identification');
    propertySetName.dataset.elementId = 0;
    ulItem.appendChild(propertySetName);


    for(const propertySet of propertySets){

      let ulItem = document.createElement('li');
      ulItem.classList.add("nav-item");
      ulSelector.appendChild(ulItem);

      let propertySetName = document.createElement('div');
      propertySetName.classList.add("nav-link");
      propertySetName.textContent = decodeIFCString(propertySet.Name.value);
      propertySetName.dataset.elementId = propertySet.expressID;
      ulItem.appendChild(propertySetName);
      
    }

    addPropertyEntry(table, props);
  };

  window.onkeydown = (event) => {
    if (event.code === "KeyP") {
      viewer.clipper.createPlane();
    } else if (event.code === "KeyO") {
      viewer.clipper.deletePlane();
    }
  };

  measure.classList.replace('btn-dark','btn-light');
  selection.classList.replace('btn-light','btn-dark');
}

async function measureModel(){

  clearSelection();
  window.onmousemove = () => {};

  viewer.dimensions.active = true;
  viewer.dimensions.previewActive = true;
  window.ondblclick = () => {
    viewer.dimensions.create();
  }

  window.onkeydown = (event) => {
    if(event.code === 'Delete') {
      viewer.dimensions.delete();
    } else if (event.code === "KeyP") {
      viewer.clipper.createPlane();
    } else if (event.code === "KeyO") {
      viewer.clipper.deletePlane();
    }
  }

  measure.classList.replace('btn-light','btn-dark');
  selection.classList.replace('btn-dark','btn-light');
}

async function checkModel(){

  viewer.IFC.selector.unpickIfcItems();
  loadingStart();

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
  subset = await newSubsetOfType(fail_set);
  scene.add(subset);
  pickable.push(subset);

  loadingEnd();
  document.getElementById("save-success-message").classList.remove("invisible");
  setTimeout(function(){
    document.getElementById("save-success-message").classList.add("invisible")},2000);

  checked = true;

  while (ulSelector.firstChild){
    ulSelector.removeChild(ulSelector.firstChild);
  }

  const body = table.querySelector('tbody');
  while (body.firstChild){
    body.removeChild(body.firstChild);
  }

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

async function addPropertyEntry(table, properties){

  const { modelID, id } = result;

  const body = table.querySelector('tbody');
  while (body.firstChild){
    body.removeChild(body.firstChild);
  }

  let typeDescription;
  let materialDescription;
  let propertyName;
  let propertyValue;
  let realValues = [];

  for(const element of properties.type){
    if(element.Name){
      typeDescription = element.Name.value;
    } 
  }

  for(const element of properties.mats){
    if(element.Materials){
      for(const material of element.Materials){
        const id = material.value;
        const value = await viewer.IFC.loader.ifcManager.getItemProperties(modelID, id);
        realValues.push(value);
      }
      element.Materials = realValues;
    } else if(element.Name) {
      materialDescription = element.Name.value;
    }
  }

  for(const element of properties.mats){
    if(element.Materials){
      for(const material of element.Materials){
        console.log(material);
        if(materialDescription){
          materialDescription = materialDescription + ", " + decodeIFCString(material.Name.value);
        } else{
          materialDescription = decodeIFCString(material.Name.value);
        }
      }
    }
  }

  delete properties.psets;
  delete properties.mats;
  delete properties.type;
  
  for(let key in properties){
    let row = document.createElement('tr');
    body.appendChild(row);
    propertyName = document.createElement('td');
    propertyName.textContent = key;
    row.appendChild(propertyName);

    let value;

    if(decodeIFCString(properties[key] == null || decodeIFCString(properties[key]) === undefined)){
      value = "Unknown";
    } else if(decodeIFCString(properties[key]) && key == 'expressID') {
      value = decodeIFCString(properties[key]);
    } else {
      value = decodeIFCString(properties[key].value);
    }
    propertyValue = document.createElement('td');
    propertyValue.textContent = value;
    row.appendChild(propertyValue);
  }

  row = document.createElement('tr');
  body.appendChild(row);
  propertyName = document.createElement('td');
  propertyName.textContent = 'Type Name';
  row.appendChild(propertyName);

  propertyValue = document.createElement('td');
  propertyValue.textContent = decodeIFCString(typeDescription);
  row.appendChild(propertyValue);

  row = document.createElement('tr');
  body.appendChild(row);
  propertyName = document.createElement('td');
  propertyName.textContent = 'Material';
  row.appendChild(propertyName);

  propertyValue = document.createElement('td');
  propertyValue.textContent = materialDescription;
  row.appendChild(propertyValue);

  if(checked){
    row = document.createElement('tr');
    body.appendChild(row);
    propertyName = document.createElement('td');
    propertyName.textContent = 'Missing Properties';
    row.appendChild(propertyName);
  
    propertyValue = document.createElement('td');
    propertyValue.textContent = missingProperties(properties.expressID);
    row.appendChild(propertyValue);
  }  
}

async function loadTable(pset){

  if(pset == 0){
    const { modelID, id } = result;
    const props = await viewer.IFC.getProperties(modelID, id, true, false);
    addPropertyEntry(table, props);

  } else{
    const { modelID, id } = result;

    const propertySet = await viewer.IFC.loader.ifcManager.getItemProperties(modelID, parseInt(pset));
  
    const realValues = [];
    const complexValues = [];
  
    if(propertySet.HasProperties){
      for(const propriedade of propertySet.HasProperties){
        const id = propriedade.value;
        const value = await viewer.IFC.loader.ifcManager.getItemProperties(modelID, id);
        realValues.push(value);
      }
      propertySet.HasProperties = realValues;
    }
  
    if(propertySet.Quantities){
      for(const propriedade of propertySet.Quantities){
        const id = propriedade.value;
        const value = await viewer.IFC.loader.ifcManager.getItemProperties(modelID, id);
        realValues.push(value);
      propertySet.Quantities = realValues;
     }
    }
  
    const body = table.querySelector('tbody');
    while (body.firstChild){
      body.removeChild(body.firstChild);
    }
  
    if(propertySet.HasProperties){
      for(let key of propertySet.HasProperties){
  
        let row = document.createElement('tr');
        body.appendChild(row);
        const propertyName = document.createElement('td');
        propertyName.textContent = decodeIFCString(key.Name.value); 
        row.appendChild(propertyName);
    
        let value;
    
        if(decodeIFCString(key.NominalValue.value == null || decodeIFCString(key.NominalValue.value) === undefined)){
          value = "Unknown";
        } else {
          value = decodeIFCString(key.NominalValue.value);
        }
        let propertyValue = document.createElement('td');
        propertyValue.textContent = value;
        row.appendChild(propertyValue);
      }
    }
  
    if(propertySet.Quantities){
      for(let key of propertySet.Quantities){
  
        if(key.HasQuantities){
          for(const propComplex of key.HasQuantities){
            const complexId = propComplex.value;
            const complexValue = await viewer.IFC.loader.ifcManager.getItemProperties(modelID, complexId);
            complexValues.push(complexValue);
          }
          key.HasQuantities = complexValues;
        }
  
        if(key.HasQuantities){
  
          for(const propComplex of key.HasQuantities){
  
            let row = document.createElement('tr');
            body.appendChild(row);
            const propertyName = document.createElement('td');
            propertyName.textContent = decodeIFCString(key.Name.value + "." + propComplex.Name.value); 
            row.appendChild(propertyName);
            
            let value;
            if(propComplex.LengthValue){
              value = propComplex.LengthValue.value;
            } else if(propComplex.AreaValue){
              value = propComplex.AreaValue.value;
            } else if(propComplex.VolumeValue){
              value = propComplex.VolumeValue.value;
            } else if(propComplex.WeightValue){
              value = propComplex.WeightValue.value;
            } else{
              value = "Unknown";
            }
            let propertyValue = document.createElement('td');
            propertyValue.textContent = value;
            row.appendChild(propertyValue);
          }
        } else {
  
          let row = document.createElement('tr');
          body.appendChild(row);
          const propertyName = document.createElement('td');
          propertyName.textContent = decodeIFCString(key.Name.value); 
          row.appendChild(propertyName);
  
          let value;
  
          if(key.LengthValue){
            value = key.LengthValue.value;
          } else if(key.AreaValue){
            value = key.AreaValue.value;
          } else if(key.VolumeValue){
            value = key.VolumeValue.value;
          } else if(key.WeightValue){
            value = key.WeightValue.value;
          } else{
            value = "Unknown";
          }
          let propertyValue = document.createElement('td');
          propertyValue.textContent = value;
          row.appendChild(propertyValue);
          }
        }
      }
  }
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

document.getElementById("navigation").addEventListener("click",clickEventHandler);
