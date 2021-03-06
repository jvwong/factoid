const http = require('express').Router();
const _ = require('lodash');
const uuid = require('uuid');
const fetch = require('node-fetch');
const { tryPromise } = require('../../../../util');
const emailTransport = require('../../../email-transport');
const h = require('hyperscript');

const Document = require('../../../../model/document');
const db = require('../../../db');
const logger = require('../../../logger');

const provider = require('./reach');

const { BIOPAX_CONVERTER_URL, BASE_URL } = require('../../../../config');

let newDoc = ({ docDb, eleDb, id, secret, meta }) => {
  return new Document( _.assign( {}, docDb, {
    factoryOptions: eleDb,
    data: _.assign( {}, { id, secret }, meta )
  } ) );
};

let loadDoc = ({ docDb, eleDb, id }) => {
  let doc = newDoc({ docDb, eleDb, id });

  return doc.load().then( () => doc );
};

let createDoc = ({ docDb, eleDb, secret, meta }) => {
  let doc = newDoc({ docDb, eleDb, secret, meta });

  return doc.create().then( () => doc );
};

let tables = ['document', 'element'];

let loadTable = name => db.accessTable( name );

let loadTables = () => Promise.all( tables.map( loadTable ) ).then( dbInfos => ({
  docDb: dbInfos[0],
  eleDb: dbInfos[1]
}) );

let getDocJson = doc => doc.json();

let fillDoc = ( doc, text ) => {
  return provider.get( text ).then( res => {
    return doc.fromJson( res );
  } ).then( () => doc );
};

// run cytoscape layout on server side so that the document looks ok on first open
let runLayout = doc => {
  let run = () => doc.applyLayout();
  let getDoc = () => doc;

  return tryPromise( run ).then( getDoc );
};

let getReachOutput = text => provider.getRawResponse( text );

let handleResponseError = response => {
  if (!response.ok) {
    throw Error(response.statusText);
  }
  return response;
};

let getBiopaxFromTemplates = templates => {
  return fetch( BIOPAX_CONVERTER_URL + 'json-to-biopax', {
    method: 'POST',
    body: JSON.stringify(templates),
    headers: {
      'Content-Type': 'application/json',
      'Accept':'application/vnd.biopax.rdf+xml' }
  } )
  .then(handleResponseError);
};

let getSbgnFromTemplates = templates => {
  return fetch( BIOPAX_CONVERTER_URL + 'json-to-sbgn', {
    method: 'POST',
    body: JSON.stringify(templates),
    headers: {
      'Content-Type': 'application/json',
      'Accept':'application/xml' }
  } )
    .then(handleResponseError);
};

let sendEmail = json => {
  const j = json;

  return emailTransport.sendMail({
    from: { name: 'Factoid', address: 'noreply@pathwaycommons.org' },
    to: { name: j.authorName, address: j.authorEmail },
    cc: { name: j.editorName, address: j.editorEmail },
    replyTo: { name: 'Pathway Commons Team', address: 'pathway-commons-help@googlegroups.com ' },
    subject: `Action required: "${json.name}"`,
    html: h('div', {
      style: {
      }
    }, [
      h('p', `Dear ${j.authorName},`),
      h('p', [
        h('span', `Share your pathway with the world:  Publishing and getting your paper noticed is essential.  `),
        h('a', { href: BASE_URL }, 'Factoid'),
        h('span', `, a project by `),
        h('a', { href: 'https://pathwaycommons.org' }, `Pathway Commons`),
        h('span', `, helps you increase the visibility of your publications by linking your research to pathways.`)
      ]),
      h('p', [
        h('span', `Factoid will capture the pathway data in `),
        h('strong', `"${j.authorName} et el.  ${j.name}.  Submission ${j.trackingId}"`),
        h('span', ` by helping you draw and describe genes and interactions:`)
      ]),
      h('ul', [
        h('li', `Launch Factoid for your article by clicking the link.`),
        h('li', `Check over genes and interactions Factoid may have found in your text.`),
        h('li', `Draw genes (circles) or interactions (lines or arrows) then add information at the prompts.`),
      ]),
      h('p', `That's it!  We'll get the pathway data to researchers who need it.`),
      h('a', {
        href: `${BASE_URL}/document/${j.id}/${j.secret}`
      }, `Launch Factoid for ${j.authorName} et al.`),
      h('p', [
        h('small', `You may also start Factoid by passing ${BASE_URL}/document/${j.id}/${j.secret} into your browser.`)
      ])
    ]).outerHTML
  });
};

http.get('/', function( req, res ){
  let limit = req.params.limit || 50;

  return (
    tryPromise( () => loadTable('document') )
    .then( t => {
      let { table, conn } = t;
      return table
        .limit(limit)
        .pluck( [ 'id', 'publicUrl' ] )
        .run( conn )
        .then( cursor => cursor.toArray() )
        .then( results => res.json( results ) );
    })
  );
});

// get existing doc
http.get('/:id', function( req, res ){
  let id = req.params.id;

  ( tryPromise( loadTables )
    .then( json => _.assign( {}, json, { id } ) )
    .then( loadDoc )
    .then( getDocJson )
    .then( json => res.json( json ) )
  );
});

// create new doc
http.post('/', function( req, res ){
  let { abstract, text, legends } = req.body;
  let meta = _.assign({}, req.body);

  // make sure the year is an int
  meta.year = parseInt(meta.year, 10) || (new Date()).getFullYear();

  let seedText = [abstract, text, legends].filter(text => text ? true : false).join('\n\n');

  let secret = uuid();

  ( tryPromise( loadTables )
    .then( ({ docDb, eleDb }) => createDoc({ docDb, eleDb, secret, meta }) )
    .then( doc => fillDoc( doc, seedText ) )
    .then( runLayout )
    .then( getDocJson )
    .then( json => {
      logger.info(`Created new doc ${json.id}`);

      return json;
    } )
    .then(json => {
      if( !json.authorEmail ){
        logger.info(`Author email address missing for new doc ${json.id}; not sending email`);

        return Promise.resolve(json);
      }

      if( !json.editorEmail ){
        logger.info(`Editor email address missing for new doc ${json.id}; not sending email`);

        return Promise.resolve(json);
      }

      logger.info(`Sending new doc ${json.id} to ${json.authorEmail} and copying to ${json.editorEmail}`);

      return sendEmail(json).then(() => json);
    })
    .then(json => {
      return res.json( json );
    })
    .catch( e => {
      logger.error(`Could not fill doc from text: ${text}`);
      logger.error('Exception thrown :', e.message);
      res.sendStatus(500);

      throw e;
    } )
  );
});

// TODO remove this route as reach should never need to be queried directly
http.post('/query-reach', function( req, res ){
  let text = req.body.text;

  getReachOutput( text )
  .then( reachRes => reachRes.json() )
  .then( reachJson => res.json(reachJson) );
});

http.get('/biopax/:id', function( req, res ){
  let id = req.params.id;
  tryPromise( loadTables )
    .then( json => _.assign( {}, json, { id } ) )
    .then( loadDoc )
    .then( doc => doc.toBiopaxTemplates() )
    .then( getBiopaxFromTemplates )
    .then( result => result.text() )
    .then( owl => res.send( owl ));
});

http.get('/sbgn/:id', function( req, res ){
  let id = req.params.id;
  tryPromise( loadTables )
    .then( json => _.assign( {}, json, { id } ) )
    .then( loadDoc )
    .then( doc => doc.toBiopaxTemplates() )
    .then( getSbgnFromTemplates )
    .then( result => result.text() )
    .then( xml => res.send( xml ));
});

http.get('/text/:id', function( req, res ){
  let id = req.params.id;
  tryPromise( loadTables )
    .then( json => _.assign( {}, json, { id } ) )
    .then( loadDoc )
    .then( doc => doc.toText() )
    .then( txt => res.send( txt ));
});

module.exports = http;
