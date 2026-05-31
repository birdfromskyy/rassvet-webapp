import { useEffect, useState } from 'react'
import Header from '../components/Header/Header'
import Footer from '../components/Footer/Footer'
import { siteSettingService, getUploadUrl } from '../services/cmsService'
import { FiAward, FiBook, FiCpu, FiHeart } from 'react-icons/fi'
import './Donation.scss'

const DEFAULTS = {
  donation_recipient:      'ИП Якубенок О.А.',
  donation_inn:            '860103708451',
  donation_bank:           'ЗАПАДНО-СИБИРСКОЕ ОТДЕЛЕНИЕ №8647 ПАО СБЕРБАНК',
  donation_bik:            '047102651',
  donation_ks:             '30101810800000000651',
  donation_rs:             '40802810667170025337',
  donation_sberpay_number: '10003-54985',
  donation_qr_url:         '',
}
const KEYS = Object.keys(DEFAULTS)

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button className="donation__copy" onClick={copy} title="Скопировать">
      {copied ? '✓' : '⎘'}
    </button>
  )
}

export default function Donation() {
  const [s, setS] = useState(DEFAULTS)

  useEffect(() => { document.title = 'Поддержать центр' }, [])

  useEffect(() => {
    Promise.allSettled(KEYS.map(k => siteSettingService.getByKey(k))).then(results => {
      const loaded = { ...DEFAULTS }
      KEYS.forEach((k, i) => {
        if (results[i].status === 'fulfilled' && results[i].value?.value)
          loaded[k] = results[i].value.value
      })
      setS(loaded)
    })
  }, [])

  const qrUrl = s.donation_qr_url ? getUploadUrl(s.donation_qr_url) : null

  const requisites = [
    { label: 'Получатель',            value: s.donation_recipient },
    { label: 'ИНН',                   value: s.donation_inn },
    { label: 'Банк',                  value: s.donation_bank },
    { label: 'БИК',                   value: s.donation_bik },
    { label: 'Корр. счёт',            value: s.donation_ks },
    { label: 'Расчётный счёт',        value: s.donation_rs },
  ]

  return (
    <div className="page page--donation">
      <Header />

      <main className="donation">
        <div className="container donation__container">

          {/* ── Hero ── */}
          <section className="donation__hero">
            <span className="section-badge">Поддержать центр</span>
            <h1>Помогите детям найти свой рассвет</h1>
            <p className="donation__hero-lead">
              Центр «РАСсвет» работает с детьми с расстройством аутистического
              спектра и другими особенностями развития. Каждый день наши
              педагоги, логопеды и дефектологи помогают детям делать то, что
              раньше казалось невозможным — говорить, учиться, дружить, расти.
            </p>
            <p className="donation__hero-lead" style={{ marginTop: '-8px' }}>
              Многие семьи, которые к нам приходят, находятся в сложной жизненной
              ситуации. Ваша поддержка помогает нам сохранять доступность занятий,
              развивать программы и быть рядом с теми, кто в нас нуждается.
            </p>
            <div className="donation__hero-stories">
              <div className="donation__story">
                <span className="donation__story-icon">💬</span>
                <p>Кто-то впервые произнёс своё имя и посмотрел маме в глаза</p>
              </div>
              <div className="donation__story">
                <span className="donation__story-icon">📖</span>
                <p>Кто-то научился сидеть за партой и слушать занятие от начала до конца</p>
              </div>
              <div className="donation__story">
                <span className="donation__story-icon">🤝</span>
                <p>Кто-то нашёл здесь первых настоящих друзей и почувствовал себя своим</p>
              </div>
              <div className="donation__story">
                <span className="donation__story-icon">🌱</span>
                <p>Кто-то сделал первые шаги к самостоятельности в повседневной жизни</p>
              </div>
            </div>
            <p className="donation__hero-cta">
              За каждой из этих историй — месяцы работы, терпение и вера в ребёнка.
              Ваш вклад делает эти истории возможными.
            </p>
          </section>

          {/* ── Disclaimer ── */}
          <div className="donation__notice">
            <strong>Важная информация.</strong> Получатель средств —{' '}
            <strong>{s.donation_recipient}</strong> — является индивидуальным
            предпринимателем, а не благотворительной или некоммерческой организацией.
            Перевод является добровольным взносом на поддержку деятельности центра и
            не признаётся пожертвованием в соответствии с законодательством РФ.
            Налоговый вычет (ст.&nbsp;219 НК РФ) не предусмотрен. Возврат добровольных
            взносов не производится.
          </div>

          {/* ── Main cards ── */}
          <section className="donation__content">

            {/* QR card */}
            <div className="donation__card donation__card--qr">
              <h2>Оплата по QR-коду</h2>
              <p className="donation__card-hint">
                Откройте приложение СберБанк, нажмите «Оплатить» → «По QR-коду» и
                наведите камеру. Или просто наведите камеру телефона на код.
              </p>

              <div className="donation__qr-wrap">
                {qrUrl
                  ? <img src={qrUrl} alt="QR-код для оплаты" className="donation__qr-img" />
                  : <div className="donation__qr-placeholder">QR-код<br/>загружается в CMS</div>
                }
              </div>

              {s.donation_sberpay_number && (
                <div className="donation__sberpay">
                  <span className="donation__sberpay-label">Номер СберПэй</span>
                  <div className="donation__sberpay-value">
                    <strong>{s.donation_sberpay_number}</strong>
                    <CopyButton value={s.donation_sberpay_number} />
                  </div>
                </div>
              )}
            </div>

            {/* Requisites card */}
            <div className="donation__card donation__card--req">
              <h2>Банковские реквизиты</h2>
              <p className="donation__card-hint">
                Для перевода через мобильный банк или интернет-банк любого банка.
                Нажмите <span className="donation__copy-hint">⎘</span>, чтобы скопировать.
              </p>

              <div className="donation__req-list">
                {requisites.map(({ label, value }) => (
                  <div className="donation__req-row" key={label}>
                    <span className="donation__req-label">{label}</span>
                    <span className="donation__req-value">
                      {value}
                      <CopyButton value={value} />
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </section>

          {/* ── How it helps ── */}
          <section className="donation__impact">
            <h2>Куда идут ваши средства</h2>
            <div className="donation__impact-grid">
              {[
                { Icon: FiAward,  text: 'Обучение и повышение квалификации наших специалистов' },
                { Icon: FiBook,   text: 'Учебные материалы, игровые и коррекционные пособия' },
                { Icon: FiCpu,    text: 'Диагностическое и коррекционное оборудование' },
                { Icon: FiHeart,  text: 'Новые программы для детей с разными потребностями' },
              ].map(({ Icon, text }) => (
                <div className="donation__impact-item" key={text}>
                  <span className="donation__impact-icon"><Icon /></span>
                  <p>{text}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Closing ── */}
          <section className="donation__closing">
            <p>
              Спасибо, что думаете о наших детях. Любая помощь — это шаг к тому,
              чтобы каждый ребёнок мог раскрыться в своём темпе и почувствовать себя
              увиденным.
            </p>
            <p>— Команда центра «РАСсвет»</p>
          </section>

        </div>
      </main>

      <Footer />
    </div>
  )
}
