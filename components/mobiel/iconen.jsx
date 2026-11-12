// Iconen van de gsm-app: dezelfde bibliotheek als de webversie (IBM Carbon, components/maps/iconen.jsx).
import { Icoon } from '../maps/iconen';

const I = (naam) => function MbIcoon({ maat = 22 }) { return <Icoon naam={naam} maat={maat} />; };

export const Ic = {
  plannen: I('plan'),
  kaart: I('kaartblad'),
  meldingen: I('bel'),
  meer: I('meer'),
  zoek: I('zoek'),
  ik: I('mijnplek'),
  lagen: I('lagen'),
  meten: I('liniaal'),
  foto: I('fotocamera'),
  wie: I('collegas'),
  melden: I('melding'),
  thuis: I('beginscherm'),
  opbouw: I('taak'),
  scherm: I('laptop'),
  account: I('gebruiker'),
  deel: I('link'),
  route: I('navigeer'),
  terug: I('chevronlinks'),
};
