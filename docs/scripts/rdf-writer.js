// docs/scripts/rdf-writer.js

import { IRI, NS, PART_TYPES_WITH_TEXT_VALUE } from './config.js';

/**
 * Escape a JS string as a Turtle string literal.
 * @param {string} value
 * @returns {string}
 */
function turtleString(value) {
  return '"' + String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n') + '"';
}

/**
 * Wrap an IRI for Turtle.
 * @param {string} iri
 * @returns {string}
 */
function iriRef(iri) {
  return '<' + String(iri) + '>';
}

/**
 * Build a predicate-object line for an IRI object.
 * @param {string} predicate
 * @param {string} objectIri
 * @returns {string}
 */
function poIri(predicate, objectIri) {
  return '    ' + iriRef(predicate) + ' ' + iriRef(objectIri);
}

/**
 * Build a predicate-object line for a literal object.
 * @param {string} predicate
 * @param {string|number} value
 * @returns {string}
 */
function poLiteral(predicate, value) {
  return '    ' + iriRef(predicate) + ' ' + turtleString(value);
}

/**
 * Serialize normalized parts to Turtle without external RDF libraries.
 * @param {object[]} parts
 * @returns {Promise<string>}
 */
export async function serializePartsToTurtle(parts) {
  var lines = [];

  lines.push('@prefix rdf: <' + NS.rdf + '> .');
  lines.push('@prefix rdfs: <' + NS.rdfs + '> .');
  lines.push('@prefix owl: <' + NS.owl + '> .');
  lines.push('@prefix dcterms: <' + NS.dcterms + '> .');
  lines.push('@prefix cco: <' + NS.cco + '> .');
  lines.push('@prefix bfo: <' + NS.bfo + '> .');
  lines.push('@prefix ex: <' + NS.ex + '> .');
  lines.push('');

  for (var i = 0; i < parts.length; i += 1) {
    var part = parts[i];
    var po = [];

    po.push(poIri(NS.rdf + 'type', IRI.namedIndividual));
    po.push(poIri(NS.rdf + 'type', IRI.informationContentEntity));

    if (part.label) {
      po.push(poLiteral(IRI.label, part.label));
    }

    if (part.partType) {
      po.push(poLiteral(IRI.dctermsType, part.partType));
    }

    if (PART_TYPES_WITH_TEXT_VALUE.has(part.partType) && part.textValue) {
      po.push(poLiteral(IRI.hasTextValue, part.textValue));
    }

    if (part.parentIri) {
      po.push(poIri(IRI.continuantPartOf, part.parentIri));
    }

    if (part.priorIri) {
      po.push(poIri(IRI.hasImmediatelyPriorDocumentPart, part.priorIri));
    }

    if (part.posteriorIri) {
      po.push(poIri(IRI.hasImmediatelyPosteriorDocumentPart, part.posteriorIri));
    }

    if (part.siblingIndex !== null && part.siblingIndex !== undefined) {
      po.push(poLiteral(IRI.hasSiblingIndex, part.siblingIndex));
    }

    if (part.styleId) {
      po.push(poLiteral(IRI.hasStyleId, part.styleId));
    }

    if (part.styleName) {
      po.push(poLiteral(IRI.hasStyleName, part.styleName));
    }

    if (part.headingLevel !== null && part.headingLevel !== undefined) {
      po.push(poLiteral(IRI.hasHeadingLevel, part.headingLevel));
    }

    lines.push(iriRef(part.iri));
    for (var j = 0; j < po.length; j += 1) {
      lines.push(po[j] + (j === po.length - 1 ? ' .' : ' ;'));
    }
    lines.push('');
  }

  for (var k = 0; k < parts.length; k += 1) {
    var child = parts[k];
    if (child.parentIri) {
      lines.push(
        iriRef(child.parentIri) + ' ' +
        iriRef(IRI.hasContinuantPart) + ' ' +
        iriRef(child.iri) + ' .'
      );
    }
  }

  lines.push('');
  return lines.join('\n');
}