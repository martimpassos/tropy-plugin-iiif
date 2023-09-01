const { readFile } = require('fs/promises')
const { expand, Manifest, Resource } = require('./manifest')
const LABELS = require('./labels.json')
const { IIIFBuilder } = require('iiif-builder');
const jsonld = require('jsonld')
const builder = new IIIFBuilder();
const util = require('util');


class IIIFPlugin {
  constructor(options, context) {
    this.context = context
    this.options = {
      ...IIIFPlugin.defaults,
      ...options
    }
    console.log(context)
    console.log(options)
  }

  async import(payload) {
    let { files } = payload

    if (!files)
      files = await this.prompt()
    if (!files)
      return

    payload.data = []

    for (let file of files) {
      try {
        let data = JSON.parse(await readFile(file))
        let [manifest] = await Manifest.parse(data, this.context.json)

        payload.data.push(this.convert(manifest))
      } catch (e) {
        this.context.logger.warn(
          {
            stack: e.stack
          },
          `failed to import IIIF manifest ${file}`
        )
      }
    }
  }

  async export(data) {

    let manifests = []
    //const zip = new JSZip();

    for (let item of data) {
      try {
        let manifest = this.convertTropy(item)
        console.log(builder.toPresentation2({id: manifest.id, type: 'Manifest'}))
        manifests.push(manifest)
        //zip.file(`${manifest.id}.json`, manifest)
      } catch (e) {
        console.log(e.stack)
        // this.context.logger.warn(
        //   {
        //     stack: e.stack
        //   },
        //   `failed to export IIIF manifest ${item}`
        // )
      }
    } 

    //collection = createCollection(manifests, this.options.collectionInfo)
    //zip.file(`${this.options.collectionName}`, collection)
    
  }

  async convertTropy(item) {

    //let iMap = this.mapIdsToLabels(undefined)
    //let pMap = this.mapIdsToLabels(undefined)

    //const resource = new Resource(item)
    async function parse(data, jsonld) {
      let expanded = await expand(jsonld, data)
      return expanded
      }
  
    let expanded = await parse(item, jsonld)
    //console.log(util.inspect(expanded, { depth: null }))
    const newManifest = builder.createManifest(
        'https://example.org/iiif/1.json', // this.options.baseId
        manifest => {
            manifest.addLabel(expanded[0]['@graph'][0]['http://purl.org/dc/elements/1.1/title'][0]['@value']);
        }
    )
    console.log(newManifest)
    return newManifest
  }

  convertManifest(manifest) {
    let { props, canvases } = manifest
    let { itemTemplate, photoTemplate } = this.options

    let iMap = this.mapLabelsToIds(this.loadTemplate(itemTemplate))
    let pMap = this.mapLabelsToIds(this.loadTemplate(photoTemplate))

    return {
      ...props,
      ...manifest.getMetadataProperties(iMap),
      template: itemTemplate || undefined,
      photo: canvases.flatMap((c) =>
        c.images.map((i) => ({
          ...c.props,
          ...c.getMetadataProperties(pMap),
          ...i.props,
          ...i.getMetadataProperties(pMap),
          template: photoTemplate || undefined
        }))
      )
    }
  }

  mapLabelsToIds(template) {
    if (!template)
      return LABELS

    let map = {}

    for (let { label, property } of template.fields) {
      if (label) map[label] = property
    }

    return map
  }

  loadTemplate(id) {
    return this.context.window.store?.getState().ontology.template[id]
  }

  prompt() {
    return this.context.dialog.open({
      filters: [
        {
          name: 'IIIF Manifests',
          extensions: ['json']
        }
      ],
      properties: ['openFile', 'multiSelections']
    })
  }

  static defaults = {
    itemTemplate: '',
    photoTemplate: ''
  }
}

module.exports = IIIFPlugin
