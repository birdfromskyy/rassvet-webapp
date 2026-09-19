import { useEffect, useRef, useState } from "react";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import { siteSettingService, getUploadUrl } from "../../services/cmsService";
import { FiAward, FiBook, FiCpu, FiHeart } from "react-icons/fi";
import useReveal from "../../hooks/useReveal";
import useBrandFont from "../../hooks/useBrandFont";
import donationImage from "../../assets/donation.png";
import "./Donation.scss";

/* Donation page — "Rassvet 2.0" design (Skills/Design2.md).
   Same data & behaviour: CMS-driven requisites, QR, SberPay number,
   and copy-to-clipboard buttons. */

const DEFAULTS = {
  donation_recipient: "ИП Якубенок О.А.",
  donation_inn: "860103708451",
  donation_bank: "ЗАПАДНО-СИБИРСКОЕ ОТДЕЛЕНИЕ №8647 ПАО СБЕРБАНК",
  donation_bik: "047102651",
  donation_ks: "30101810800000000651",
  donation_rs: "40802810667170025337",
  donation_sberpay_number: "10003-54985",
  donation_qr_url: "",
};

const KEYS = Object.keys(DEFAULTS);

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <button className="dn-copy" onClick={copy} title="Скопировать" type="button">
      {copied ? "✓" : "⎘"}
    </button>
  );
}

export default function Donation() {
  const rootRef = useRef(null);
  const [s, setS] = useState(DEFAULTS);

  useEffect(() => {
    document.title = "Поддержать центр";
  }, []);

  useBrandFont();

  useEffect(() => {
    Promise.allSettled(KEYS.map((key) => siteSettingService.getByKey(key))).then(
      (results) => {
        const loaded = { ...DEFAULTS };
        KEYS.forEach((key, index) => {
          if (
            results[index].status === "fulfilled" &&
            results[index].value?.value
          ) {
            loaded[key] = results[index].value.value;
          }
        });
        setS(loaded);
      },
    );
  }, []);

  useReveal(rootRef, [s.donation_qr_url]);

  const qrUrl = s.donation_qr_url ? getUploadUrl(s.donation_qr_url) : null;

  const requisites = [
    { label: "Получатель", value: s.donation_recipient },
    { label: "ИНН", value: s.donation_inn },
    { label: "Банк", value: s.donation_bank },
    { label: "БИК", value: s.donation_bik },
    { label: "Корр. счёт", value: s.donation_ks },
    { label: "Расчётный счёт", value: s.donation_rs },
  ];

  const stories = [
    { icon: "💬", text: "Кто-то впервые произнёс своё имя и посмотрел маме в глаза" },
    { icon: "📖", text: "Кто-то научился сидеть за партой и слушать занятие от начала до конца" },
    { icon: "🤝", text: "Кто-то нашёл здесь первых настоящих друзей" },
    { icon: "🌱", text: "Кто-то сделал первые шаги к самостоятельности" },
  ];

  const impact = [
    { Icon: FiAward, text: "Обучение и повышение квалификации наших специалистов" },
    { Icon: FiBook, text: "Учебные материалы, игровые и коррекционные пособия" },
    { Icon: FiCpu, text: "Диагностическое и коррекционное оборудование" },
    { Icon: FiHeart, text: "Новые программы для детей с разными потребностями" },
  ];

  return (
    <div className="donation-page" ref={rootRef}>
      <Header />

      {/* ── Hero (dark) ────────────────────────────────────────── */}
      <section className="d2-section d2-hero">
        <div className="d2-hero__glow" aria-hidden="true" />
        <div className="page-container d2-hero__inner">
          <div className="d2-hero__content" data-reveal>
            <span className="d2-tag">Поддержать центр</span>
            <h1 className="d2-hero__title">Помогите детям найти свой рассвет</h1>
            <p className="d2-hero__text">
              Центр «РАСсвет» работает с детьми с расстройством аутистического
              спектра и другими особенностями развития. Каждый день наши
              педагоги, логопеды и дефектологи помогают детям делать то, что
              раньше казалось невозможным — говорить, учиться, дружить, расти.
            </p>
          </div>
          <div className="d2-hero__visual" data-reveal data-reveal-delay="1">
            <img className="dn-hero-img" src={donationImage} alt="" />
          </div>
        </div>
      </section>

      {/* ── Stories + payment (light) ──────────────────────────── */}
      <section className="d2-section d2-section--auto dn-section">
        <div className="page-container">
          <div className="dn-stories" data-reveal>
            {stories.map((story) => (
              <div className="dn-story" key={story.text}>
                <span className="dn-story__icon">{story.icon}</span>
                <p>{story.text}</p>
              </div>
            ))}
          </div>

          <p className="dn-lead" data-reveal>
            За каждой из этих историй — месяцы работы, терпение и вера в ребёнка.
            Ваш вклад делает эти истории возможными.
          </p>

          <div className="dn-cards" data-reveal>
            <div className="dn-card">
              <h2>Оплата по QR-коду</h2>
              <p className="dn-card__hint">
                Откройте приложение СберБанк, нажмите «Оплатить» → «По QR-коду» и
                наведите камеру. Или просто наведите камеру телефона на код.
              </p>
              <div className="dn-qr">
                {qrUrl ? (
                  <img src={qrUrl} alt="QR-код для оплаты" />
                ) : (
                  <div className="dn-qr__placeholder">QR-код загружается в CMS</div>
                )}
              </div>
              {s.donation_sberpay_number && (
                <div className="dn-sberpay">
                  <span className="dn-sberpay__label">Номер СберПэй</span>
                  <span className="dn-sberpay__value">
                    <strong>{s.donation_sberpay_number}</strong>
                    <CopyButton value={s.donation_sberpay_number} />
                  </span>
                </div>
              )}
            </div>

            <div className="dn-card">
              <h2>Банковские реквизиты</h2>
              <p className="dn-card__hint">
                Для перевода через мобильный банк или интернет-банк любого банка.
                Нажмите <span className="dn-copy-hint">⎘</span>, чтобы скопировать.
              </p>
              <div className="dn-req">
                {requisites.map(({ label, value }) => (
                  <div className="dn-req__row" key={label}>
                    <span className="dn-req__label">{label}</span>
                    <span className="dn-req__value">
                      {value}
                      <CopyButton value={value} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="dn-impact" data-reveal>
            <h2 className="d2-h2">Куда идут ваши средства</h2>
            <div className="dn-impact__grid">
              {impact.map(({ Icon, text }) => (
                <div className="dn-impact__item" key={text}>
                  <span className="dn-impact__icon">
                    <Icon />
                  </span>
                  <p>{text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="dn-closing" data-reveal>
            <p>
              Спасибо, что думаете о наших детях. Любая помощь — это шаг к тому,
              чтобы каждый ребёнок мог раскрыться в своём темпе и почувствовать
              себя увиденным.
            </p>
            <p className="dn-closing__sign">— Команда центра «РАСсвет»</p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
