
const Link = ({ to, children, className = '', ...props }) => {
  const handleClick = (e) => {
    e.preventDefault();
    window.location.hash = to;
  };

  return (
    <a href={`#${to}`} onClick={handleClick} className={className} {...props}>
      {children}
    </a>
  );
};

export default Link;