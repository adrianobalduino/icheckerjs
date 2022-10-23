import { Color, Matrix3 } from 'three';
import { IfcViewerAPI } from 'web-ifc-viewer';

const container = document.getElementById('viewer-container');
let viewer = new IfcViewerAPI({ container, backgroundColor: new Color(0xffffff) });

// Create grid and axes
viewer.grid.setGrid();
viewer.axes.setAxes();

// Get all elements
const loadIfcButton = document.getElementById('load-ifc');
const loadRequirements = document.getElementById('load-json');
const checkIfc = document.getElementById('check');
const measure = document.getElementById('measure');
const table = document.getElementById('info-table');
const body = table.querySelector('tbody');
const selection = document.getElementById('selection');
const ulSelector = document.getElementById('ulItem');
const form = document.getElementById("storeyForm");
const inputIfc = document.getElementById('file-input-ifc');
const inputRequirements = document.getElementById('file-input-json');

// Set up the button logic
inputRequirements.onchange = () => loadJson();
inputIfc.onchange = () => loadIfc();
loadIfcButton.onclick = () => inputIfc.click();
loadRequirements.onclick = () => inputRequirements.click();
checkIfc.onclick = () => checkModel();
measure.onclick = () => measureModel();
selection.onclick = () => selectionMode();
document.getElementById("navigation").addEventListener("click",clickEventHandler);

// Set global parameters
let checked = false;
let result;
let model;
let reqPar;
let scene;
let subset;
let missingProp = [];
const pickable = viewer.context.items.pickableIfcModels;
const index = pickable.indexOf(model);
const fail = [];
const fail_property = [];

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
  loadIfcButton.classList.remove('disabled');
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
  const buildingStoreys =[];
  model = await viewer.IFC.loadIfcUrl(url);
  // Add dropped shadow and post-processing efect
  await viewer.shadowDropper.renderShadow(model.modelID);   
  viewer.clipper.active = true;
  selectionMode();
  scene = viewer.context.getScene();
  const project = await viewer.IFC.getSpatialStructure(model.modelID);
  for(const site of project.children){
    for(const building of site.children){
      for(const buildingStorey of building.children){
        const buildingStoreyId = buildingStorey.expressID;
        const buildingStoreyElement = await viewer.IFC.loader.ifcManager.getItemProperties(model.modelID, buildingStoreyId);
        buildingStoreys.push(decodeIFCString(buildingStoreyElement.Name.value));
      }
    }
  }
  fillStoreyForm(buildingStoreys);
  checkIfc.classList.remove('disabled');
  form.classList.remove('disabled');
  loadingEnd();
  document.getElementById("save-success-message").classList.remove("invisible");
  setTimeout(function(){
    document.getElementById("save-success-message").classList.add("invisible")},2000);
}

async function clearSelection(){
  viewer.IFC.selector.unpickIfcItems();
}

function fillStoreyForm(storeys){

  let option;

  while(form.firstChild){
    form.removeChild(form.firstChild);
  }

  for(const storey of storeys){
    option = document.createElement('option');
    option.textContent = storey;
    form.appendChild(option);
  }
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
    clearNavBar();
    createNavItem('Identification',0);

    for(const propertySet of propertySets){
      createNavItem(propertySet.Name.value,propertySet.expressID);
    }
    loadTableIdentification(table, props);
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

  const selectedStorey = document.getElementById("storeyForm").value;
  let storeyId;
  let relatedElements;
  let ifc_entity;
  let property_set;
  let property_value;
  let all_ifc_classes = [];
  let flag_propriedade = 0;
  let decomposedElements = [];

  const filteredParameters = reqPar.filter(item => item.PropertySet != 'Identification');
  const propertyValues = Object.values(prop);
  const allPsetsRels = propertyValues.filter(item => item.type === 'IFCRELDEFINESBYPROPERTIES');
  const allRelAgg = propertyValues.filter(item => item.type === 'IFCRELAGGREGATES');
  const allStoreys = propertyValues.filter(item => item.type === 'IFCBUILDINGSTOREY');
  const allRelContained = propertyValues.filter(item => item.type === 'IFCRELCONTAINEDINSPATIALSTRUCTURE');

  for(const storey of allStoreys){
    if(decodeIFCString(storey.Name) == selectedStorey){
      storeyId = storey.expressID;
    }
  }

  const specificRelContained= allRelContained.filter(item => item.RelatingStructure == storeyId);

  for(const specificRel of specificRelContained){
    relatedElements = specificRel.RelatedElements;
  }

  for(const eachRelAgg of allRelAgg){
    if(relatedElements.includes(eachRelAgg.RelatingObject)){
      decomposedElements.push(eachRelAgg.RelatedObjects);
    }
  }
  
  const allElements = relatedElements.concat(decomposedElements.flat());

  for (value in filteredParameters){
    property_value = filteredParameters[value].IFCEntity;
    all_ifc_classes.push(property_value);
  }
  const set_ifc_classes = [...new Set(all_ifc_classes)];
  const filteredValues = propertyValues.filter(item => set_ifc_classes.includes(item.type));
  const filteredByFloor = filteredValues.filter(item => allElements.includes(item.expressID));

  for(var key in filteredByFloor){
    for(value in filteredParameters){
      ifc_entity = filteredParameters[value].IFCEntity;
      property_set = filteredParameters[value].PropertySet;
      property_value = filteredParameters[value].Property;
      if(filteredByFloor[key].type == ifc_entity){
        const relatedPsetsRels = allPsetsRels.filter(item => item.RelatedObjects.includes(filteredByFloor[key].expressID));
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
          fail.push(filteredByFloor[key].expressID);
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

  clearTable();
  loadingEnd();
  document.getElementById("save-success-message").classList.remove("invisible");
  setTimeout(function(){
    document.getElementById("save-success-message").classList.add("invisible")},2000);

  checked = true;
  clearNavBar();
  
}

function decodeIFCString(ifcString) {
  const ifcUnicodeRegEx = /\\X2\\(.*?)\\X0\\/uig;
  let propString = ifcString;
  let match = ifcUnicodeRegEx.exec(ifcString);
  let unicodeChar;
  while (match) {
      if(match[1].length == 4){
        unicodeChar = String.fromCharCode(parseInt(match[1], 16));
      } else {
        const numCaracteres = match[1].length/4;
        const arrayCaracteres = [];
        let j;

        for(let i=0; i<numCaracteres;i++){
          if(i == 0){
            j=4;
          } else {
            j=4*(i+1);
          }
          arrayCaracteres.push(String.fromCharCode(parseInt(match[1].slice(i*4,j),16)));
        }
        unicodeChar = arrayCaracteres.join("");
      }
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

async function loadTableIdentification(table, properties){

  const { modelID, id } = result;
  clearTable();

  let typeDescription;
  let materialDescription;
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
    let value;
    if(decodeIFCString(properties[key] == null || decodeIFCString(properties[key]) === undefined)){
      value = "Unknown";
    } else if(decodeIFCString(properties[key]) && key == 'expressID') {
      value = decodeIFCString(properties[key]);
    } else {
      value = decodeIFCString(properties[key].value);
    }
    createRow(key, value);
  }

  createRow('Material',materialDescription);
  createRow('Type Name', typeDescription);

  if(checked){
    createRow('Missing Properties', missingProperties(properties.expressID))
  }  
}

async function loadTable(pset){
  if(pset == 0){
    const { modelID, id } = result;
    const props = await viewer.IFC.getProperties(modelID, id, true, false);
    loadTableIdentification(table, props);
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
    clearTable();
    if(propertySet.HasProperties){
      for(let key of propertySet.HasProperties){
        let value;
        if(key.NominalValue.value == null || key.NominalValue.value === undefined){
          value = "Unknown";
        } else {
          value = key.NominalValue.value;
        }
        createRow(key.Name.value,value);
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
            createRow(key.Name.value + "." + propComplex.Name.value,value);
          }
        } else {
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
          createRow(key.Name.value,value);
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

function clearTable(){
  while (body.firstChild){
    body.removeChild(body.firstChild);
  }
}

function clearNavBar(){
  while (ulSelector.firstChild){
    ulSelector.removeChild(ulSelector.firstChild);
  }
}

function createRow(key,value){
  row = document.createElement('tr');
  body.appendChild(row);
  propertyName = document.createElement('td');
  propertyName.textContent = decodeIFCString(key);
  row.appendChild(propertyName);

  propertyValue = document.createElement('td');
  propertyValue.textContent = decodeIFCString(value);
  row.appendChild(propertyValue);
}

function createNavItem(name, id){
  let ulItem = document.createElement('li');
  ulItem.classList.add("nav-item");
  ulSelector.appendChild(ulItem);
  let propertySetName = document.createElement('div');
  propertySetName.classList.add("nav-link");
  propertySetName.textContent = decodeIFCString(name);
  if(name == 'Identification'){
    propertySetName.classList.add("active");
  }
  propertySetName.dataset.elementId = id;
  ulItem.appendChild(propertySetName);
}