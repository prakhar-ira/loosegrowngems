import Logo from '~/assets/logo.png';
import {NavLink} from '@remix-run/react';
import React from 'react';
import {activeLinkStyle} from './Footer';

const Assignment = () => {
  return (
    <svg
      width="52"
      height="59"
      viewBox="0 0 52 59"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M25.8111 46.9832C26.2833 46.9832 26.6791 46.8235 26.9986 46.5041C27.318 46.1846 27.4777 45.7888 27.4777 45.3166C27.4777 44.8443 27.318 44.4485 26.9986 44.1291C26.6791 43.8096 26.2833 43.6499 25.8111 43.6499C25.3388 43.6499 24.943 43.8096 24.6236 44.1291C24.3041 44.4485 24.1444 44.8443 24.1444 45.3166C24.1444 45.7888 24.3041 46.1846 24.6236 46.5041C24.943 46.8235 25.3388 46.9832 25.8111 46.9832ZM24.6444 38.1499H26.9777V17.8166H24.6444V38.1499ZM5.14439 58.1499C3.76939 58.1499 2.59244 57.6602 1.61355 56.6807C0.634109 55.7018 0.144386 54.5249 0.144386 53.1499V11.8166C0.144386 10.4416 0.634109 9.26435 1.61355 8.2849C2.59244 7.30601 3.76939 6.81657 5.14439 6.81657H21.3111C20.6999 5.20546 20.8666 3.69157 21.8111 2.2749C22.7555 0.858236 24.1027 0.149902 25.8527 0.149902C27.6027 0.149902 28.9499 0.858236 29.8944 2.2749C30.8388 3.69157 30.9777 5.20546 30.3111 6.81657H46.4777C47.8527 6.81657 49.0299 7.30601 50.0094 8.2849C50.9883 9.26435 51.4777 10.4416 51.4777 11.8166V53.1499C51.4777 54.5249 50.9883 55.7018 50.0094 56.6807C49.0299 57.6602 47.8527 58.1499 46.4777 58.1499H5.14439ZM5.14439 55.8166H46.4777C47.1444 55.8166 47.7555 55.5388 48.3111 54.9832C48.8666 54.4277 49.1444 53.8166 49.1444 53.1499V11.8166C49.1444 11.1499 48.8666 10.5388 48.3111 9.98324C47.7555 9.42768 47.1444 9.1499 46.4777 9.1499H5.14439C4.47772 9.1499 3.86661 9.42768 3.31105 9.98324C2.7555 10.5388 2.47772 11.1499 2.47772 11.8166V53.1499C2.47772 53.8166 2.7555 54.4277 3.31105 54.9832C3.86661 55.5388 4.47772 55.8166 5.14439 55.8166ZM25.8111 7.48324C26.5333 7.48324 27.1305 7.24713 27.6027 6.7749C28.0749 6.30268 28.3111 5.70546 28.3111 4.98324C28.3111 4.26101 28.0749 3.66379 27.6027 3.19157C27.1305 2.71935 26.5333 2.48324 25.8111 2.48324C25.0888 2.48324 24.4916 2.71935 24.0194 3.19157C23.5472 3.66379 23.3111 4.26101 23.3111 4.98324C23.3111 5.70546 23.5472 6.30268 24.0194 6.7749C24.4916 7.24713 25.0888 7.48324 25.8111 7.48324Z"
        fill="#1C1B1F"
      />
    </svg>
  );
};

export function PolicyContainer() {
  return (
    <div className="policies-container-parent">
      <div className="policies-container">
        <NavLink prefetch="intent" to="/" style={activeLinkStyle} end>
          <img src={Logo} alt={'Logo'} className="footer-logo" />
        </NavLink>
        <h1>RETURN POLICY</h1>
        <p>
          At Loose Grown Gems, we believe that your satisfaction goes beyond the
          purchase. We&apos;re dedicated to making sure you feel confident and
          happy with your jewelry every step of the way. If for any reason
          you&apos;re not completely satisfied, we offer a 10-Day Money-Back
          Guarantee. You can return or exchange any items within{' '}
          <b>10 days of delivery</b>, with no hassle and at no cost to you.
        </p>
        <p>
          If you have any questions or concerns, we&apos;re here to assist you!
          To ensure that your return is processed smoothly, please ensure the
          item is in new, unworn condition and includes all original packaging,
          certificates, and documentation. A receipt or proof of purchase will
          also be required.
        </p>
        <div className="how-to-return-container">
          <h4>How to return items</h4>
          <div className="return-box">
            <h5>1</h5>
            <div className="right-box">
              <h5>Start Your Return</h5>
              <p>
                Contact us at info@loosegrowngems.com with your order number,
                and we&apos;ll guide you through the return process
              </p>
            </div>
          </div>
          <div className="return-box">
            <h5>2</h5>
            <div className="right-box">
              <h5>Prepare the Item for Return</h5>
              <p>
                Once your return is initiated, we&apos;ll send you a pre-paid,
                insured shipping label along with simple instructions for how to
                return the item. Please package the jewelry securely in its
                original box, including all grading reports, appraisals, and
                accessories. For your security, please avoid writing
                &quot;Complete Carat&quot; on the exterior of the return box.
              </p>
            </div>
          </div>
          <div className="return-box">
            <h5>3</h5>
            <div className="right-box">
              <h5>Ship the Item Back</h5>
              <p>
                Use the provided return shipping label to send the item back to
                us. We highly recommend shipping with insurance for your peace
                of mind, as we are not responsible for any lost or stolen items
                that are returned without the provided label.
              </p>
            </div>
          </div>
          <div className="return-box">
            <h5>4</h5>
            <div className="right-box">
              <h5>After We Receive Your Return</h5>
              <p>
                Once we receive your returned item, it will be inspected and
                processed within 48 business hours. You will receive a
                notification when it has been passed to our Quality Assurance
                team. Please note: If the item has been altered by a third-party
                jeweller, the return eligibility or warranty may be voided. It
                typically takes up to 10 business days to complete the return
                process. We will notify you via email once your refund is
                processed or if additional information is required. We take
                great care to ensure that your order arrives in perfect
                condition. However, if your item is damaged, defective, or
                incorrect, please reach out to us immediately after receipt.
                We&apos;ll work quickly to resolve the issue to your
                satisfaction.
              </p>
            </div>
          </div>
          <div className="return-box">
            <h5>5</h5>
            <div className="right-box">
              <h5>Once the Return is Inspected and Approved</h5>
              <p>
                We will issue a refund to your original payment method within 10
                business days. Please note that your bank or credit card company
                may take additional time to process the refund. If you
                haven&apos;t received your refund after 10 business days, please
                reach out to us at info@completecarat.com for assistance. For
                the quickest way to get the item you truly want, we recommend
                returning the original item and placing a new order for the
                replacement. If you need assistance with the process, our team
                is here to help!
              </p>
            </div>
          </div>
          <hr className="policy-grid-body-divider" />
          <div className="return-box">
            <h5>
              <Assignment />
            </h5>
            <div className="right-box">
              <h5>Important Information</h5>
              <p>
                Loose Grown Gems reserves the right to modify this return policy
                at any time without prior notice. We encourage you to review our
                policy before completing your purchase. If you have any
                questions or need assistance, our friendly Customer Service team
                is always here to help—just reach out to us! Thank you for
                choosing Loose Grown Gems. We truly appreciate your trust in us
                and are committed to delivering a shopping experience that
                exceeds your expectations.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
