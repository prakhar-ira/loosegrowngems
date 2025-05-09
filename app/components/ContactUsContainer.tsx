import {InlineWidget} from 'react-calendly';
import Logo from '~/assets/logo.png';
import {NavLink} from '@remix-run/react';
import React from 'react';
import {activeLinkStyle} from './Footer';

export function ContactUsContainer() {
  return (
    <div className="policies-container-parent">
      <div className="policies-container">
        <NavLink prefetch="intent" to="/" style={activeLinkStyle} end>
          <img src={Logo} alt={'Logo'} className="footer-logo" />
        </NavLink>
        <h1>CONTACT US</h1>
        <div className="w-[999px] h-[600px]">
          <InlineWidget url="https://calendly.com/completecarat/30min" />
        </div>
      </div>
    </div>
  );
}
