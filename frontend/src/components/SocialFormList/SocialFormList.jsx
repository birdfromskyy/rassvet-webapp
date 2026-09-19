import "./SocialFormList.scss";

const forms = [
  {
    title: "Социальное обслуживание на дому",
    text: "Оказание социальных услуг получателям в привычной домашней обстановке.",
  },
  {
    title: "Полустационарное социальное обслуживание",
    text: "Предоставление социальных услуг в Центре в течение определённого времени без постоянного проживания.",
  },
];

function SocialFormList() {
  return (
    <section className="socialForm">
      <div className="page-container">
        <div className="socialForm__grid">
          {forms.map((item) => (
            <article className="socialFormCard" key={item.title}>
              <div className="socialFormCard__icon">✓</div>

              <div>
                <h2>{item.title}</h2>
                <p>{item.text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default SocialFormList;