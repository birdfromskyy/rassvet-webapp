import "./Reviews.scss";
import userIcon from "../../assets/review-user.png";

const reviews = [
  {
    text: "После занятий ребёнок стал спокойнее и легче идёт на контакт.",
    author: "Елена, мама",
  },
  {
    text: "Специалисты помогли подобрать индивидуальный подход к нашему сыну.",
    author: "Антон, папа",
  },
  {
    text: "Очень тёплая атмосфера и внимательное отношение к детям.",
    author: "Карина, мама",
  },
];

function Reviews() {
  return (
    
    <section className="reviews">
      <div className="reviews__wave-top">
  <svg viewBox="0 0 1440 120" preserveAspectRatio="none">
    <path
      d="M0,40 C240,100 480,0 720,40 C960,80 1200,20 1440,60 L1440,0 L0,0 Z"
      fill="#f7f4ec"
    />
  </svg>
</div>
      <div className="container reviews__inner">
        <h2 className="reviews__title">Отзывы родителей</h2>

        <div className="reviews__grid">
          {reviews.map((review, index) => (
            <article className="reviews__card" key={index}>
              <div className="reviews__bubble">
                <p>{review.text}</p>
                <span className="reviews__bubble-tail"></span>
              </div>

              <div className="reviews__meta">
                <img src={userIcon} alt="" className="reviews__avatar" />
                <div className="reviews__info">
                  <div className="reviews__author">{review.author}</div>
                  <div className="reviews__stars">★★★★★</div>
                </div>
              </div>
            </article>
          ))}
        </div>

        <a href="#" className="reviews__btn">
          Все отзывы
        </a>
      </div>
    </section>
  );
}

export default Reviews;