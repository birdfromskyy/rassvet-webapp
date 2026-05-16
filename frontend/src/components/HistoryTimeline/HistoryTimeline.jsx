import "./HistoryTimeline.scss";

const timeline = [
  {
    year: "2022",
    items: [
      "1 июля — создание организации.",
      "Реализован проект «Тренировочная квартира для детей с РАС» на средства гранта губернатора ХМАО-Югры.",
    ],
  },
  {
    year: "2023",
    items: [
      "Реализован проект «Включение в городскую среду детей с РАС» на средства гранта «Родные города».",
      "Победа в региональном этапе конкурса «Мой добрый бизнес — 2023».",
      "Победа в премии «Признание» в номинации «Милосердие без границ».",
      "Участие во Всероссийском инклюзивном фестивале «#ЛюдиКакЛюди».",
    ],
  },
  {
    year: "2024",
    items: [
      "ТОП-1000 проекта «Сильные идеи для нового времени».",
      "Реализован проект «Отпуск как отпуск» на средства гранта губернатора ХМАО-Югры.",
      "Сотрудничество со студентами ЮГУ в рамках проекта «Обучение служением».",
      "Участие во Всероссийском инклюзивном фестивале «#ЛюдиКакЛюди».",
    ],
  },
  {
    year: "2025",
    items: [
      "Участие во Всероссийском инклюзивном фестивале «#ЛюдиКакЛюди».",
      "Сотрудничество со студентами ЮГУ в рамках проекта «Обучение служением».",
      "Организация рабочих мест для несовершеннолетних совместно с Центром занятости населения Югры.",
    ],
  },
];

function HistoryTimeline() {
  return (
    <section className="history-timeline">
      <div className="container history-timeline__inner">
        <div className="history-timeline__heading">
          <h2 className="history-timeline__title">Достижения по годам</h2>
        </div>

        <div className="history-timeline__list">
          {timeline.map((block) => (
            <article className="history-year" key={block.year}>
              <div className="history-year__date">{block.year}</div>

              <div className="history-year__content">
                {block.items.map((item, index) => (
                  <p key={index}>{item}</p>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default HistoryTimeline;