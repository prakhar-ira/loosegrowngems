export default function ErrorContainer({status}: {status: number}) {
  return (
    <div className="custom-404-error">
      <div className="policies-container-parent mt-4">
        <h1 className="text-center text-lg">
          {status === 404 ? 'PAGE NOT FOUND' : 'INTERNAL SERVER ERROR'}
        </h1>
        <p className="text-center bold text-3xl">
          {status === 404
            ? 'The page you were looking for doesnt exist. You may have mistyped the address or the page may have moved.'
            : 'There is error while loading page, please try again after sometime or refresh page.'}
        </p>
      </div>
    </div>
  );
}
