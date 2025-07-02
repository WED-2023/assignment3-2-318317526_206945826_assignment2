const axios = require("axios");
const DButils = require("./DButils");

/* ----------  SPOONACULAR CONSTANTS ------------------------------------------------------------ */
const api_domain = "https://api.spoonacular.com/recipes";  
const API_KEY = process.env.spooncular_apiKey;
if (!API_KEY) {
  throw new Error("Spoonacular API key is not defined in environment variables.");
}


/* ----------  HELPERS ------------------------------------------------------------------------- */
/**
 * Spoonacular wrapper for endpoints.
 */
async function spoonacularRequest(endpoint, params = {}) {
  try {
    const { data } = await axios.get(`${api_domain}${endpoint}`, {
      params: { ...params, apiKey: API_KEY },
    });
    return data;
  } catch (e) {
    console.error(`Spoonacular API error: ${e.message}. Endpoint: ${endpoint}`);
    throw { status: 502, message: "Failed to fetch data from Spoonacular" };
  }
}
/**
 * Get recipes list from spooncular response and extract the relevant recipe data for preview
 * @param {*} recipes_info
 */

async function getRecipeInformation(recipe_id) {
  try {
    const response = await axios.get(`${api_domain}/${recipe_id}/information`, {
      params: {
        includeNutrition: false,
        apiKey: API_KEY,
      },
    });
    return response;
  } catch (error) {
    console.error("Error fetching recipe information:", error.message);
    throw { status: 502, message: "Failed to fetch recipe information from Spoonacular" };
  }
}

/**
 * Get { favorite, viewed } flags in one DB round-trip.
 */
async function getRecipeFlags(userId, source, recipeId) {
  console.log("getRecipeFlags called with userId:", userId, "source:", source, "recipeId:", recipeId);
  if (!userId) return { favorite: false, viewed: false };

  const rows = await DButils.execQuery(`
    SELECT
       EXISTS(SELECT 1 FROM favoriterecipes
              WHERE user_id = '${userId}' AND recipe_id = '${recipeId}' AND source = '${source}') AS favorite,
       EXISTS(SELECT 1 FROM last_viewed
              WHERE user_id = '${userId}' AND recipe_id = '${recipeId}' AND source = '${source}') AS viewed
  `);
  const row = rows[0];
  return { favorite: !!row.favorite, viewed: !!row.viewed };
}

/**
 * Build a unified “preview” object and auto-attach favorite / viewed flags when context is given.
 */
async function buildPreview(src,{ userId = null, source = null, extras = {} } = {})
 {
  const {
    recipe_id,
    id,
    title,
    image,
    readyInMinutes,
    vegan       = false,
    vegetarian  = false,
    glutenFree  = false,
  } = src;

  const preview = {
    id            : recipe_id ?? id,
    title,
    image,
    readyInMinutes,
    vegan         : !!vegan,
    vegetarian    : !!vegetarian,
    glutenFree    : !!glutenFree,
    favorite      : false,
    viewed        : false,
    ...extras,
  };
  console.log("buildPreview called with userId:", userId, "source:", source, "recipeId:", preview.id);
  if (userId && source) {
    Object.assign(preview, await getRecipeFlags(userId, source, preview.id));
  }
  return preview;
}

/* ----------  SPOONACULAR – recipe details ----------------------------------------------------- */
async function getRecipeDetails(recipe_id, userId = null) {
  let recipe_info = await getRecipeInformation(recipe_id);
  return buildPreview(recipe_info.data, { userId, source: "api" });
  }
async function getAllRecipeDetails(recipe_id,userId = null) {
  const { data } = await getRecipeInformation(recipe_id);

  const {
    summary,                  
    extendedIngredients,
    instructions,
    servings,
  } = data;

  const base = await buildPreview(data, { userId, source: "api" });
  return {
    ...base,
    ingredients : data.extendedIngredients.map(i => ({
      name  : i.name,
      amount: i.amount,
      unit  : i.unit,
    })),
    instructions: data.instructions,
    servings    : data.servings,
    summary,
  };
}

/* ----------  SPOONACULAR – random & search ---------------------------------------------------- */
async function getRandomRecipes(number) {
  const { recipes } = await spoonacularRequest("/random",{ number, includeNutrition: false });
  return Promise.all(recipes.map(r =>
    buildPreview(r, { source: "api" })
  ));
}

async function searchRecipes(userId, query, filters = {}, number = 5) {
  console.log(" in recipe utils user id = ", userId);
  const { results } = await spoonacularRequest("/complexSearch", {
    query,
    number,
    instructionsRequired : true,
    cuisine      : filters.cuisine,
    diet         : filters.diet,
    intolerances : filters.intolerances,
    sort         : filters.sortBy === "time" ? "readyInMinutes" : undefined,
  });
  console.log("searchRecipes called with userId:", userId, "query:", query, "filters:", filters, "number:", number);
  console.log("Search results:", results);
  return Promise.all(results.map(r =>
    buildPreview(r, { userId, source: "api" })
  ));
}

/* ----------  USER RECIPES (local) ------------------------------------------------------------- */

async function addUserRecipe(user_id, recipeData) {
  const {
    title,
    readyInMinutes,
    image,
    vegetarian,
    vegan,
    glutenFree,
    ingredients,
    instructions,
    servings,
  } = recipeData;

  const ingredients_json = JSON.stringify(ingredients);

  const query = `
    INSERT INTO user_recipes
    (user_id, title, readyInMinutes, image, vegetarian, vegan, glutenFree, instructions, servings, ingredients)
    VALUES (
      '${user_id}',
      '${title}',
      ${readyInMinutes},
      '${image}',
      ${vegetarian ? 1 : 0},
      ${vegan ? 1 : 0},
      ${glutenFree ? 1 : 0},
      '${instructions}',
      ${servings},
      '${ingredients_json}'
    )
  `;

  await DButils.execQuery(query);
}

/**
 * This function returns a list of preview data for user-created recipes
 * @param {Array} recipe_id -  recipe id created by the user
 * @param {string} user_id - id of the user who created the recipes
 * @returns {Array} - list of recipe preview objects
 */
async function getUserRecipePreview(recipe_id, user_id) {
  const recipes = await DButils.execQuery(`
    SELECT recipe_id, title, image, readyInMinutes, vegan, vegetarian, glutenFree
    FROM user_recipes
    WHERE recipe_id = ${recipe_id} AND user_id = '${user_id}'
  `);

  if (recipes.length === 0) return [];

  const recipe = recipes[0];

  return buildPreview(recipe, {userId:user_id, source: "user" })
}

async function getAllUserPreviewRecipes(user_id) {
    const recipes = await DButils.execQuery(`
        SELECT recipe_id, title, image, readyInMinutes, vegan, vegetarian, glutenFree
        FROM user_recipes
        WHERE user_id = '${user_id}'
    `);

      return Promise.all(recipes.map(r =>
    buildPreview(r, {userId:user_id, source: "user" })
  ));
}


async function getAllUserFullRecipe(recipe_id, user_id) {
  const [row] = await DButils.execQuery(
    `SELECT * FROM user_recipes WHERE recipe_id = '${recipe_id}' AND user_id = '${user_id}'`
  );

  if (!row) {
    throw { status: 404, message: "User recipe not found" };
  }
  const base = await buildPreview(row, { userId:user_id, source: "user" });
  return {
    ...base,
    instructions: row.instructions,
    servings    : row.servings,
    ingredients : row.ingredients,
  };
}

/* ----------  FAMILY RECIPES (local) ----------------------------------------------------------- */

async function addFamilyRecipe(user_id, recipeData) {
  const {
    title,
    image,
    readyInMinutes,
    vegan,
    vegetarian,
    glutenFree,
    ingredients,
    instructions,
    servings,
    when_to_prepare,
    owner_name = "Me"
  } = recipeData;

  const ingredients_json = JSON.stringify(ingredients);

  const query = `
    INSERT INTO family_recipes
    (user_id, title, image, readyInMinutes, vegan, vegetarian, glutenFree, ingredients, instructions, servings, when_to_prepare, owner_name)
    VALUES (
      '${user_id}',
      '${title}',
      '${image}',
      ${readyInMinutes},
      ${vegan ? 1 : 0},
      ${vegetarian ? 1 : 0},
      ${glutenFree ? 1 : 0},
      '${ingredients_json}',
      '${instructions}',
      ${servings},
      '${when_to_prepare}',
      '${owner_name}'
    )
  `;

  await DButils.execQuery(query);
}

async function getAllFamilyPreviewRecipes(recipe_id = null, user_id) {
  let query = `
    SELECT recipe_id, title, image, readyInMinutes, vegan, vegetarian, glutenFree, when_to_prepare, owner_name
    FROM family_recipes
    WHERE user_id = '${user_id}'
  `;
  if (recipe_id) {
    query += ` AND recipe_id = '${recipe_id}'`;
  }

  const recipes = await DButils.execQuery(query);

  if (recipe_id) {
    if (recipes.length === 0) return [];
    const r = recipes[0];
    return buildPreview(r, {
      userId: user_id,
      source: "family",
    });
  }

  return Promise.all(recipes.map(r =>
    buildPreview(r, {
      userId: user_id,
      source: "family",
      extras: {
        owner: r.owner_name,
        when_to_prepare: r.when_to_prepare,
      },
    })
  ));
}


async function getAllFamilyFullRecipe(recipe_id, user_id) {
  const [row] = await DButils.execQuery(`
    SELECT * FROM family_recipes
    WHERE recipe_id = '${recipe_id}' AND user_id = '${user_id}'
  `);

    if (!row) throw { status: 404, message: "Family recipe not found" };

  const base = await buildPreview(row, {
      userId: user_id,
      source : "family",
      extras : {
        owner          : row.owner_name,
        when_to_prepare: row.when_to_prepare,
      },
    });

    return {
      ...base,
      instructions: row.instructions,
      servings    : row.servings,
      ingredients : row.ingredients,
    };
  }

/* ----------  USER ACTIVITY: last_viewed ------------------------------------------------------- */

async function addRecipeView(user_id, recipe_id, source) {

  const query = `
    INSERT INTO last_viewed (user_id, recipe_id, source, view_time)
    VALUES ('${user_id}', '${recipe_id}', '${source}', CURRENT_TIMESTAMP)
    ON DUPLICATE KEY UPDATE
      view_time = CURRENT_TIMESTAMP,
      source = VALUES(source)
  `;
  await DButils.execQuery(query);
}


async function getLastViewedRecipes(user_id) {
  const lastViewedRows = await DButils.execQuery(`
    SELECT recipe_id, source
    FROM last_viewed
    WHERE user_id = '${user_id}'
    ORDER BY view_time DESC
    LIMIT 3
  `);

  return Promise.all(lastViewedRows.map(({ recipe_id, source }) => {
    if (source === "user")   return getUserRecipePreview(recipe_id, user_id);
    if (source === "api")    return getRecipeDetails(recipe_id, user_id);
    if (source === "family") return getAllFamilyPreviewRecipes(recipe_id, user_id);
    throw new Error(`Unknown recipe source: ${source}`);
  }));
}

/* ----------  EXPORTS ------------------------------------------------------------------------- */
module.exports = {
  /* External */
  getRecipeInformation,     
  getRecipeDetails,
  getAllRecipeDetails,
  getRandomRecipes,
  searchRecipes,
  /* User recipes */
  addUserRecipe,
  getUserRecipePreview,
  getAllUserPreviewRecipes,
  getAllUserFullRecipe,
  /* Family recipes */
  addFamilyRecipe,
  getAllFamilyPreviewRecipes,
  getAllFamilyFullRecipe,
  /* Activity */
  addRecipeView,
  getLastViewedRecipes,
};