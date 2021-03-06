const { error } = require('../../../util');
const { PARTICIPANT_TYPE } = require('../participant-type');

const VALUE = 'unset';
const DISPLAY_VALUE = 'Unset';

const allowedParticipantTypes = () => { // i.e. settable by the user
  const T = PARTICIPANT_TYPE;

  return [ T.UNSIGNED, T.POSITIVE, T.NEGATIVE ];
};

// abstract base class
class InteractionType {
  constructor( interaction ){
    if( !interaction ){
      throw error(`Can not create interaction type without an 'interaction' reference`);
    }

    this.interaction = interaction;
  }

  static allowedParticipantTypes(){
    return allowedParticipantTypes();
  }

  allowedParticipantTypes(){
    return allowedParticipantTypes();
  }

  has( pptType ){
    return this.interaction.participantsOfType(pptType).length > 0;
  }

  isPositive(){
    return this.has( PARTICIPANT_TYPE.POSITIVE );
  }

  isNegative(){
    return this.has( PARTICIPANT_TYPE.NEGATIVE );
  }

  isSigned(){
    return this.isPositive() || this.isNegative();
  }

  getSign() {
    let T = PARTICIPANT_TYPE;

    if( this.isNegative() ){
      return T.NEGATIVE;
    } else if ( this.isPositive() ){
      return T.POSITIVE;
    } else {
      return T.UNSIGNED;
    }
  }

  isComplete(){
    return false;
  }

  setParticipantAs( ppt, type ){
    let intn = this.interaction;
    let signedPpts = intn.participantsNotOfType( PARTICIPANT_TYPE.UNSIGNED ).filter( unsignedPpt => unsignedPpt.id() !== ppt.id() );
    let makeUnsigned = ppt => intn.retypeParticipant( ppt, PARTICIPANT_TYPE.UNSIGNED );

    return Promise.all([
      intn.retypeParticipant( ppt, type ),
      signedPpts.map( makeUnsigned )
    ]);
  }

  getTarget(){
    let intn = this.interaction;
    let ppts = intn.participantsNotOfType( PARTICIPANT_TYPE.UNSIGNED );
    // assoc. cannot have more than one target,
    // but this must be checked somewhere else (no need to throw an exception here)
    return( ppts.length > 1 ) ? null : ppts[0];
  }

  setTarget( ppt ){
    if( this.isNegative() ){
      return this.setParticipantAs( ppt, PARTICIPANT_TYPE.NEGATIVE );
    } else if( this.isPositive() ){
      return this.setParticipantAs( ppt, PARTICIPANT_TYPE.POSITIVE );
    } else {
      throw new Error(`Can not set target of unsigned/undirected interaction`);
    }
  }

  getSource(){
    let intn = this.interaction;
    let ppts = intn.participantsOfType( PARTICIPANT_TYPE.UNSIGNED );
    // assoc. cannot have more than one source,
    // but this must be checked somewhere else (no need to throw an exception here)
    return ( ppts.length > 1 ) ? null : ppts[0];
  }

  toBiopaxTemplate() {
    throw new Error(`Abstract method toBiopaxTemplate() is not overridden for interaction type of ${this.value}`);
  }

  toString(verbPhrase, post = ''){
    let src, tgt;

    // covers cases: positive, negative, unsigned-target
    src = this.getSource();
    tgt = this.getTarget();

    if( !src || !tgt ){
      if( this.isSigned() ){
        throw new Error(`Source or target is undefined for signed interaction type ${this.value}`);
      }

      // fall back on unordered list
      [src, tgt] = this.interaction.participants();
    }

    if( !verbPhrase ){
      verbPhrase = this.getSign().verbPhrase;
    }

    let srcName = src.name() || '(?)';
    let tgtName = tgt.name() || '(?)';

    return `${srcName} ${verbPhrase} ${tgtName} ${post}`;
  }

  static isAllowedForInteraction( intn ){ // eslint-disable-line no-unused-vars
    return false;
  }

  static get value(){ return VALUE; }
  get value(){ return VALUE; }

  static get displayValue(){ return DISPLAY_VALUE; }
  get displayValue(){ return DISPLAY_VALUE; }
}

module.exports = InteractionType;
