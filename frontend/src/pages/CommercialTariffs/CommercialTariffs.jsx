import { useEffect, useRef, useState } from "react";
import Header from "../../components/Header/Header";
import Footer from "../../components/Footer/Footer";
import commercialTariffService from "../../services/commercialTariffService";
import useBrandFont from "../../hooks/useBrandFont";
import useReveal from "../../hooks/useReveal";
import "./CommercialTariffs.scss";

const groupTariffs = (tariffs) => {
  const groups = new Map();
  tariffs.forEach((tariff) => {
    const current = groups.get(tariff.service_name) || [];
    current.push(tariff);
    groups.set(tariff.service_name, current);
  });
  return Array.from(groups, ([serviceName, options]) => ({ serviceName, options }));
};

const formatGroupVolume = (options) => {
  const minutes = options.map((option) => {
    const match = option.volume_label.match(/^\s*(\d+)\s*мин\.?\s*$/i);
    return match ? Number(match[1]) : null;
  });
  if (minutes.every((minutes) => Number.isInteger(minutes))) {
    return `${minutes.join("/")} мин`;
  }
  return options.map((option) => option.volume_label).join(" / ");
};

const formatGroupPrice = (options) => {
  if (options.every((option) => option.price_rub !== null && option.price_rub !== undefined)) {
    return options
      .map((option) => new Intl.NumberFormat("ru-RU").format(option.price_rub))
      .join("/");
  }
  return options.map((option) => option.price_note || "По запросу").join(" / ");
};

function CommercialTariffs() {
  const rootRef = useRef(null);
  const [tariffs, setTariffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useBrandFont();

  useEffect(() => {
    document.title = "Тарифы на коммерческие услуги";
    commercialTariffService
      .getAll()
      .then(setTariffs)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useReveal(rootRef, [tariffs.length, loading, error]);
  const groupedTariffs = groupTariffs(tariffs);

  return (
    <div className="commercial-tariffs-page" ref={rootRef}>
      <Header />

      <section className="d2-section d2-hero ct-hero">
        <div className="d2-hero__glow" aria-hidden="true" />
        <div className="page-container d2-hero__inner d2-hero__inner--solo">
          <div className="d2-hero__content" data-reveal>
            <span className="d2-tag">Коммерческие услуги</span>
            <h1 className="d2-hero__title">Тарифы на коммерческие услуги</h1>
            <p className="d2-hero__text">
              Стоимость услуг Центра. Точный формат и возможность получения
              услуги уточняйте у администрации.
            </p>
          </div>
        </div>
      </section>

      <section className="d2-section d2-section--auto ct-section">
        <div className="page-container">
          <div className="ct-heading" data-reveal>
            <div className="d2-head">
              <span className="d2-tag d2-tag--dark">Прайс-лист</span>
              <h2 className="d2-h2">Тарифы на коммерческие услуги</h2>
            </div>
          </div>

          {loading && <p className="d2-empty" data-reveal>Загружаем тарифы…</p>}

          {!loading && error && (
            <p className="d2-empty" data-reveal>
              Не удалось загрузить тарифы. Пожалуйста, попробуйте обновить страницу.
            </p>
          )}

          {!loading && !error && groupedTariffs.length === 0 && (
            <p className="d2-empty" data-reveal>Тарифы скоро появятся здесь.</p>
          )}

          {!loading && !error && groupedTariffs.length > 0 && (
            <div className="ct-table-wrap" data-reveal>
              <table className="ct-table">
                <thead>
                  <tr>
                    <th scope="col">№ п/п</th>
                    <th scope="col">Наименование услуги</th>
                    <th scope="col">Объем услуги</th>
                    <th scope="col">Тарифы, руб.</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedTariffs.map((tariff, index) => (
                    <tr key={tariff.serviceName}>
                      <td className="ct-table__number" data-label="№ п/п">
                        <span>{index + 1}</span>
                      </td>
                      <td className="ct-table__service" data-label="Наименование">
                        {tariff.serviceName}
                      </td>
                      <td className="ct-table__volume" data-label="Объем">
                        <span>{formatGroupVolume(tariff.options)}</span>
                      </td>
                      <td className="ct-table__price" data-label="Тарифы, руб.">
                        <span>{formatGroupPrice(tariff.options)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default CommercialTariffs;
