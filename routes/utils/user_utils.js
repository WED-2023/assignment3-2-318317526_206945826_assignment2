const DButils = require("./DButils");

async function markAsFavorite(user_id, recipe_id, source) {
    console.log("session user_id = ",user_id);
    await DButils.execQuery(
        `INSERT INTO favoriterecipes (user_id, recipe_id, source) VALUES ('${user_id}', ${recipe_id}, '${source}')`
    );
}

async function getFavoriteRecipes(user_id) {
  const recipes = await DButils.execQuery(
    `select recipe_id, source from favoriterecipes where user_id='${user_id}'`
  );
  return recipes;
}


exports.markAsFavorite = markAsFavorite;
exports.getFavoriteRecipes = getFavoriteRecipes;
